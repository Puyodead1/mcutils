const fetch = require("node-fetch").default;
const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { mkdir } = require("fs/promises");

const manifestUrl =
  "https://launchermeta.mojang.com/v1/packages/44fa141917df947ed5a138f5cfe667a34f7bbaca/1.17.json";

function fetchManifest() {
  return new Promise((resolve, reject) => {
    fetch(manifestUrl)
      .then(async (res) => {
        if (res.ok) resolve(await res.json());
        else reject(await res.text());
      })
      .catch(reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((data) => {
        const stream = fs.createWriteStream(dest);
        data.body.pipe(stream);
        stream.on("finish", resolve);
        stream.on("error", reject);
        data.body.on("error", reject);
      })
      .catch(reject);
  });
}

(async () => {
  const libsFolder = path.join(__dirname, "libs");
  if (!fs.existsSync(libsFolder)) await mkdir(libsFolder);
  function canUseLib(rules) {
    if (!rules) return true;
    return rules.some(
      (x) =>
        (x.action && x.action === "allow" && !x.os) ||
        (x.action && x.action === "allow" && x.os && x.os.name !== "osx")
    );
  }
  const manifest = await fetchManifest().catch(console.error);
  for (const lib of manifest.libraries) {
    const name = lib.name;

    const rules = lib.rules;
    const canUse = canUseLib(rules);
    if (!canUse) continue;

    const artifact = lib.downloads.artifact;
    const url = artifact.url;
    const filename = url.split("/").pop();
    const filepath = path.join(libsFolder, filename);
    if (fs.existsSync(filepath)) {
      console.log(filename + " exists, skipping");
      continue;
    }
    await download(url, filepath).catch(console.error);
    const split = name.split(":");
    const groupID = split[0];
    const artifactID = split[1];
    const version = split[2];

    const child = childProcess.exec(
      `mvn install:install-file -Dfile=${filepath} -DgroupId=${groupID} -DartifactId=${artifactID} -Dversion=${version} -Dpackaging=jar -DgeneratePom=true`
    );
    child.on("error", console.error);
    child.stderr.on("data", (chunk) => console.error(chunk.toString()));
    child.stdout.on("data", (chunk) => console.log(chunk.toString()));
  }
})();

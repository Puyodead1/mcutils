const fetch = require("node-fetch").default;
const path = require("path");
const fs = require("fs");
const { mkdir, unlink } = require("fs/promises");
const sha1File = require("sha1-file");

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
  const cmd = (libs) => `<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-install-plugin</artifactId>
  <version>2.4</version>
  <executions>
  ${libs
    .map(
      (x) =>
        `<execution>
      <id>install ${x.name}</id>
      <phase>package</phase>
      <goals>
        <goal>install-file</goal>
      </goals>
      <configuration>
        <file>${x.path}</file>
        <groupId>${x.group}</groupId>
        <artifactId>${x.artifact}</artifactId>
        <version>${x.version}</version>
      </configuration>
    </execution>`
    )
    .join("\n")}
  </executions>
  </plugin>`;
  const libs = [];
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
    const sha1 = artifact.sha1;
    const filesha = await sha1File(filepath);
    if (fs.existsSync(filepath)) {
      console.log(`${filename} exists, verifying hash...`);
      if (sha1 === filesha) {
        console.log("file integrity verified");
      } else {
        console.error("File failed integrity verification, will redownload");
        await unlink(filepath);
        await download(url, filepath).catch(console.error);
        console.log("Download complete");
      }
    } else {
      await download(url, filepath).catch(console.error);
      console.log("download complete");
    }
    const split = name.split(":");
    const groupID = split[0];
    const artifactID = split[1];
    const version = split[2];

    libs.push({
      name: filename,
      path: filepath,
      group: groupID,
      artifact: artifactID,
      version,
    });
  }

  console.log(cmd(libs));
})();

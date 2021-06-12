const fetch = require("node-fetch").default;

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

(async () => {
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

    const split = name.split(":");
    const groupID = split[0];
    const artifactID = split[1];
    const version = split[2];

    console.log(
`<dependency>
    <groupId>${groupID}</groupId>
    <artifactId>${artifactID}</artifactId>
    <version>${version}</version>
</dependency>`
    );
  }
})();

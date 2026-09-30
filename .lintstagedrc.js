function packageCheck(pkg) {
  return () =>
    `bash -c 'set -e; npm run build -w @wpstack/core; npm run lint -w @wpstack/${pkg}; npm run test -w @wpstack/${pkg}'`;
}

module.exports = {
  "packages/core/**/*.ts": packageCheck("core"),
  "packages/mcp-server/**/*.ts": packageCheck("mcp-server"),
  "packages/web-ui/**/*.ts": packageCheck("web-ui"),
  "packages/cli/**/*.ts": packageCheck("cli"),
};

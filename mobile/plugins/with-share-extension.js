const { withIosExtension } = require("./ios-extension");
/** Offline handoff; credentials and uploads belong to the foreground app. */
module.exports = (config) =>
  withIosExtension(config, {
    name: "AtmosShare",
    sources: [["share-extension", "ShareViewController.swift"]],
    resources: [
      ["assets/fonts", "AtmosHeading-Black.ttf"],
      ["assets/fonts", "AtmosBody-Regular.ttf"],
      ["assets/fonts", "AtmosDisplay-Bold.ttf"],
    ],
    info: ["share-extension", "AtmosShare-Info.plist"],
    extensionOnly: true,
  });

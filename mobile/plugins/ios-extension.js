const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const unquote = (value) =>
  typeof value === "string" ? value.replace(/^"|"$/g, "") : value;

/** Keep extension targets reproducible on both fresh and incremental prebuilds. */
function ensureExtension(
  project,
  {
    name,
    sources,
    resources = [],
    bundleIdentifier,
    developmentTeam,
    version,
    buildNumber,
    extensionOnly,
  },
) {
  const app = project.getFirstTarget();
  if (!app?.firstTarget?.productType?.includes("product-type.application"))
    throw new Error(`${name}: expected the app as the first Xcode target`);
  const objects = project.hash.project.objects;
  let targetEntry = Object.entries(project.pbxNativeTargetSection()).find(
    ([key, target]) =>
      !key.endsWith("_comment") && unquote(target.name) === name,
  );
  if (!targetEntry) {
    const target = project.addTarget(
      name,
      "app_extension",
      name,
      bundleIdentifier,
    );
    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase(
      [],
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid,
    );
    project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      target.uuid,
    );
    targetEntry = [target.uuid, project.pbxNativeTargetSection()[target.uuid]];
  }
  const [targetId, target] = targetEntry;
  let groupEntry = Object.entries(objects.PBXGroup).find(
    ([key, group]) => !key.endsWith("_comment") && unquote(group.name) === name,
  );
  if (!groupEntry) {
    const group = project.addPbxGroup([], name, name);
    const root = Object.entries(objects.PBXGroup).find(
      ([key, group]) =>
        !key.endsWith("_comment") &&
        group.name === undefined &&
        group.path === undefined,
    );
    if (!root) throw new Error(`${name}: missing root Xcode group`);
    project.addToPbxGroup(group.uuid, root[0]);
    groupEntry = [group.uuid, objects.PBXGroup[group.uuid]];
  }
  for (const [, file] of sources)
    if (
      !groupEntry[1].children.some((child) => unquote(child.comment) === file)
    )
      project.addSourceFile(file, { target: targetId }, groupEntry[0]);
  for (const [, file] of resources)
    if (
      !groupEntry[1].children.some((child) => unquote(child.comment) === file)
    ) {
      // addResourceFile assumes an app-wide Resources group, absent in Expo's template.
      const resource = project.addFile(file, groupEntry[0], {
        target: targetId,
      });
      if (!resource) throw new Error(`${name}: could not add resource ${file}`);
      resource.target = targetId;
      resource.uuid = project.generateUuid();
      project.addToPbxBuildFileSection(resource);
      project.addToPbxResourcesBuildPhase(resource);
    }
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  const linked = app.firstTarget.dependencies.some(
    (ref) => objects.PBXTargetDependency[ref.value]?.target === targetId,
  );
  if (!linked) project.addTargetDependency(app.uuid, [targetId]);
  const settings = {
    CLANG_ENABLE_MODULES: "YES",
    CODE_SIGN_ENTITLEMENTS: `${name}/${name}.entitlements`,
    CODE_SIGN_STYLE: "Automatic",
    CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
    GENERATE_INFOPLIST_FILE: "NO",
    INFOPLIST_FILE: `"${name}/${name}-Info.plist"`,
    IPHONEOS_DEPLOYMENT_TARGET: "16.2",
    MARKETING_VERSION: `"${version}"`,
    SWIFT_EMIT_LOC_STRINGS: "YES",
    SWIFT_VERSION: "5.0",
    TARGETED_DEVICE_FAMILY: '"1"',
    ...(extensionOnly ? { APPLICATION_EXTENSION_API_ONLY: "YES" } : {}),
    ...(developmentTeam ? { DEVELOPMENT_TEAM: developmentTeam } : {}),
  };
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const ref of project.pbxXCConfigurationList()[
    target.buildConfigurationList
  ].buildConfigurations)
    Object.assign(configurations[ref.value].buildSettings, settings);
}
function withIosExtension(
  config,
  { name, sources, resources = [], info, extensionOnly = false },
) {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const from = config.modRequest.projectRoot,
        to = path.join(config.modRequest.platformProjectRoot, name),
        bundleId = config.ios?.bundleIdentifier;
      if (!bundleId) throw new Error(`${name}: missing app bundle identifier`);
      fs.mkdirSync(to, { recursive: true });
      for (const [dir, file] of [...sources, ...resources, info])
        fs.copyFileSync(path.join(from, dir, file), path.join(to, file));
      fs.writeFileSync(
        path.join(to, `${name}.entitlements`),
        `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>group.${bundleId}</string></array></dict></plist>`,
      );
      return config;
    },
  ]);
  return withXcodeProject(config, (config) => {
    ensureExtension(config.modResults, {
      name,
      sources,
      resources,
      extensionOnly,
      bundleIdentifier: `${config.ios?.bundleIdentifier}.${name}`,
      developmentTeam: config.ios?.appleTeamId ?? process.env.APPLE_TEAM_ID,
      version: config.version ?? "1.0.0",
      buildNumber: config.ios?.buildNumber ?? "1",
    });
    return config;
  });
}
module.exports = { withIosExtension, ensureExtension };

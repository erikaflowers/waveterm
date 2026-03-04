const skip =
    process.env.WAVETERM_SKIP_APP_DEPS === "1" || process.env.CF_PAGES === "1" || process.env.CF_PAGES === "true";

if (skip) {
    console.log("postinstall: skipping electron-builder install-app-deps");
    process.exit(0);
}

import("child_process").then(({ execSync }) => {
    execSync("electron-builder install-app-deps", { stdio: "inherit" });

    // Rename Electron.app to Terminus.app for dev mode dock label and icon
    const path = require("path");
    const fs = require("fs");
    const electronDistDir = path.join(__dirname, "node_modules/electron/dist");
    const electronAppDir = path.join(electronDistDir, "Electron.app");
    const terminusAppDir = path.join(electronDistDir, "Terminus.app");
    if (fs.existsSync(electronAppDir)) {
        try {
            // Rename the .app bundle so macOS dock shows "Terminus"
            fs.renameSync(electronAppDir, terminusAppDir);
            console.log("postinstall: renamed Electron.app to Terminus.app");

            // Update path.txt so electron module finds the renamed binary
            const pathTxt = path.join(__dirname, "node_modules/electron/path.txt");
            fs.writeFileSync(pathTxt, "Terminus.app/Contents/MacOS/Electron");
            console.log("postinstall: updated electron path.txt");

            // Patch Info.plist bundle name
            const plist = path.join(terminusAppDir, "Contents/Info.plist");
            execSync(`defaults write "${plist}" CFBundleName -string 'Terminus (Dev)'`, { stdio: "inherit" });
            execSync(`defaults write "${plist}" CFBundleDisplayName -string 'Terminus (Dev)'`, { stdio: "inherit" });
            console.log("postinstall: patched bundle name in Info.plist");

            // Copy app icon
            const srcIcon = path.join(__dirname, "build/icon.icns");
            const destIcon = path.join(terminusAppDir, "Contents/Resources/electron.icns");
            if (fs.existsSync(srcIcon)) {
                fs.copyFileSync(srcIcon, destIcon);
                console.log("postinstall: copied app icon");
            }
        } catch (e) {
            console.warn("postinstall: failed to patch Electron bundle:", e.message);
        }
    }
});

'use strict';

const fs = require('fs');
const path = require('path');
require(path.join(__dirname, "standalone-patch"));
const fse = require('fs-extra');
const tmp = require('tmp')
const exec = require('child_process').execFile;
const spawn = require('child_process').spawn;

function getBinPath(gltfPath) {
    const gltf = JSON.parse(fs.readFileSync(gltfPath, {encoding: "utf8"}));
    return gltf["buffers"][0]["uri"];
}

function copyBuiltFiles(projectDir, origGltfPath, origBinPath, outputPath) {
    console.log("Copying built files...");
    fs.copyFileSync(path.join(projectDir, "Packages/mycompany-aircraft-simple/SimObjects/Airplanes/MyCompany_Simple_Aircraft/model/model.bin"), path.join(outputPath, path.basename(origBinPath)));
    const gltf = JSON.parse(fs.readFileSync(path.join(projectDir, "Packages/mycompany-aircraft-simple/SimObjects/Airplanes/MyCompany_Simple_Aircraft/model/model.gltf"), {encoding: "utf8"}));
    gltf["buffers"][0]["uri"] = path.basename(origBinPath);
    fs.writeFileSync(path.join(outputPath, path.basename(origGltfPath)), JSON.stringify(gltf, null, 4), {encoding: "utf8"});
    console.log("Completed");
}

function buildPackage(projectFilePath, origGltfPath, origBinPath, outputPath) {
    const projectDir = path.dirname(projectFilePath);
    const steamPath = "C:/Program Files (x86)/Steam/steam.exe";
    exec("tasklist", (err, stdout, stderr) => {
        if (stdout.includes("FlightSimulator.exe")) {
            console.log("To build while MSFS is running, open this project in the SDK:");
            console.log(projectFilePath);
            console.log("and build the aircraft. When completed, press any key to continue.")
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', () => {
                copyBuiltFiles(projectDir, origGltfPath, origBinPath, outputPath);
                process.exit();
            });
        } else {
            if (fs.existsSync("C:\\Program Files (x86)\\Steam\\steamapps\\common\\MicrosoftFlightSimulator\\FlightSimulator.exe")) {
                console.log("Found steam version, building with MSFS SDK...");
                const child = spawn(steamPath, ["-noverifyfiles", "-silent", "-nosplash", "-applaunch", "1250410", projectFilePath, "-I", ';', "BuildAssetPackages", projectFilePath, projectDir, projectDir, "Mirror", "CheckOutputTimestamps", "Console"]);

                child.on('close', (code, signal) => {
                    setTimeout(() => {
                        const waitForBuild = new Promise(function(resolve, reject) {
                            const interval = setInterval(() => {
                                require('child_process').exec("tasklist", (err, stdout, stderr) => {
                                    if (!stdout.includes("FlightSimulator.exe")) {
                                        clearInterval(interval);
                                        resolve();
                                    }
                                });
                            }, 1000);
                        });
                        waitForBuild.then(() => {
                            copyBuiltFiles(projectDir, origGltfPath, origBinPath, outputPath);
                        });
                    }, 5000);
                });
            } else {
                console.log("Could not find steam version of MSFS. This program is only compatible with the steam version of MSFS.");
            }
        }
    });
}

function run() {
    // Check args
    if (process.argv.length < 3) {
        console.error("You must supply a path to the model.");
        return;
    }

    // Get paths
    const inputPath = process.argv[2];
    const outputPath = process.argv[3] || path.dirname(inputPath);
    const binPath = getBinPath(inputPath);
    const tmpObj = tmp.dirSync({unsafeCleanup: true});
    const tempPath = tmpObj.name;

    // Copy files
    fse.copySync(path.join(__dirname, "../template"), tempPath);
    fs.copyFileSync(path.join(process.cwd(), inputPath), path.join(tempPath, "PackageSources/SimObjects/Airplanes/MyCompany_Simple_Aircraft/model/model.gltf"));
    fs.copyFileSync(path.join(path.dirname(path.join(process.cwd(), inputPath)), binPath), path.join(tempPath, "PackageSources/SimObjects/Airplanes/MyCompany_Simple_Aircraft/model/", binPath));

    // Build
    buildPackage(path.join(tempPath, "SimpleAircraftProject.xml"), path.join(process.cwd(), inputPath),  path.join(path.dirname(path.join(process.cwd(), inputPath)), binPath), outputPath);
}

run();

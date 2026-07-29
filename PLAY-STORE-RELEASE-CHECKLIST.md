# TitanOS Play Store Release Checklist

This repository currently contains a shipped Android App Bundle at `bin/static/TitanOS.aab`.
The theme-toggle fix was applied to the web shell in `bin/index.html` and does not modify the AAB artifact.

## Before uploading a new AAB

1. Keep the Android package name unchanged.
2. Keep the same signing keystore and upload key.
3. Increment `versionCode` for every Play upload.
4. Update `versionName` only when you want a user-visible release label.
5. Rebuild the AAB from the Android source used for Google Play.
6. Verify the generated bundle installs and launches correctly on a test device or emulator.
7. Confirm the dark/light theme toggle behaves correctly in the release build.
8. Confirm no unrelated assets or signing files were modified during the rebuild.

## Safe-update rule

- Editing the static web preview files in `bin/` should not be treated as a Play Store release unless the Android source is rebuilt and a new signed AAB is generated.
- Do not replace `bin/static/TitanOS.aab` unless you intentionally want to publish a new Play build.

## If Android source is missing

If the Android project files are not present in this workspace, a fresh AAB cannot be regenerated here.
In that case, preserve the existing bundle and perform the Play update from the original Android build repository.

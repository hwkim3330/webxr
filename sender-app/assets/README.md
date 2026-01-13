# App Icons

Place your application icons here:

- `icon.ico` - Windows icon (256x256 or multi-resolution .ico)
- `icon.icns` - macOS icon (512x512@2x)
- `icon.png` - Linux icon (512x512 PNG)

## Generate icons from a single PNG

If you have a 1024x1024 PNG source image:

```bash
# Install electron-icon-builder
npm install -g electron-icon-builder

# Generate all icons
electron-icon-builder --input=source.png --output=.
```

Or use online tools:
- https://www.electron.build/icons
- https://icon.kitchen/

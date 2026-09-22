Place demonstration videos here (e.g. solar_panel.mp4, object_detection.mp4).
The object info modal currently shows a placeholder overlay (see .video-placeholder in style.css and #object-modal-image in index.html).
To add a real video: add a <video> tag inside .object-modal-media in index.html, pointing to assets/videos/<name>.mp4, and toggle its visibility per-object in openObjectModal() in script.js.

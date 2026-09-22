Place real .glb/.gltf 3D models here (e.g. solar_panel.glb, mri.glb, robot.glb).
Currently all exhibits are procedurally generated Three.js primitives (see addExhibit() in script.js).
To swap in a real model: import GLTFLoader from 'three/addons/loaders/GLTFLoader.js' in script.js and load models from this folder instead of calling addExhibit() with a primitive geometry. See the comment block above addExhibit() in script.js for a code example.

// Resize and update all markers with animation
Object.keys(genericMarkers).forEach(region => {
    const markers = genericMarkers[region];
    if (markers) {
        const originalMarkerSize = 1; // Assume original size
        const targetMarkerSize = 0.5; // Target size (smaller)
        const animationDuration = 500; // Animation duration in milliseconds

        // Store the new marker meshes in an array for optional later cleanup
        const newMarkerMeshes = [];

        for (let i = 0; i < markers.count; i++) {
            const instanceMatrix = new THREE.Matrix4();
            markers.getMatrixAt(i, instanceMatrix);

            // Create marker mesh with initial size
            const markerMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(originalMarkerSize, originalMarkerSize),
                markerMaterial
            );
            markerMesh.applyMatrix4(instanceMatrix);
            scene.add(markerMesh); // Add marker to scene
            newMarkerMeshes.push(markerMesh); // Store the marker mesh

            // Animation variables
            let currentSize = originalMarkerSize;

            // Function to animate the resizing of markers
            const animateResize = (duration) => {
                const startTime = performance.now(); // Capture the start time

                const resizeStep = (currentTime) => {
                    const elapsedTime = currentTime - startTime; // Calculate elapsed time
                    const progress = Math.min(elapsedTime / duration, 1); // Normalize progress between 0 and 1

                    // Interpolate size based on progress
                    currentSize = THREE.MathUtils.lerp(originalMarkerSize, targetMarkerSize, progress);
                    markerMesh.geometry.dispose(); // Dispose of old geometry
                    markerMesh.geometry = new THREE.PlaneGeometry(currentSize, currentSize); // Update geometry

                    if (progress < 1) {
                        requestAnimationFrame(resizeStep); // Continue animation if not yet complete
                    } else {
                        // Ensure the final size is set
                        markerMesh.geometry.dispose();
                        markerMesh.geometry = new THREE.PlaneGeometry(targetMarkerSize, targetMarkerSize);
                    }
                };

                requestAnimationFrame(resizeStep); // Start the animation loop
            };

            // Delay the animation by 5 seconds (5000 ms)
            setTimeout(() => {
                animateResize(animationDuration); // Animate resizing after delay
            }, 3000); // 5-second delay
        }

        // Remove the original markers after the new markers have been added
        setTimeout(() => {
            scene.remove(markers);
            console.log(`Original markers for region ${region} removed.`);
        }, 3000); // Remove after delay, matching the animation start time
    } else {
        console.warn(`No markers found for the region: ${region}`);
    }
})
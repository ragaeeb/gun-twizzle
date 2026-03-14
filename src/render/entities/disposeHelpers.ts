import * as THREE from 'three';

/**
 * Recursively dispose all GPU resources on a Three.js object tree.
 * Call this when unmounting an entity's render representation.
 *
 * IMPORTANT: If using useGLTF from drei, the loaded scene is cached and shared.
 * Do NOT dispose the original cached scene — only dispose CLONES.
 */
export const disposeObject3D = (obj: THREE.Object3D): void => {
    obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                for (const mat of child.material) {
                    disposeMaterial(mat);
                }
            } else if (child.material) {
                disposeMaterial(child.material);
            }
        }
    });
};

const disposeMaterial = (material: THREE.Material): void => {
    material.dispose();
    // Dispose any textures attached to the material
    for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
            value.dispose();
        }
    }
};

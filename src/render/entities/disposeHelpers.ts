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
        if (isMeshLike(child)) {
            disposeMeshLike(child);
            return;
        }
        if (child instanceof THREE.Sprite) {
            disposeSprite(child);
        }
    });
};

const isMeshLike = (child: THREE.Object3D): child is THREE.Mesh | THREE.Line | THREE.Points =>
    child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points;

const disposeMeshLike = (child: THREE.Mesh | THREE.Line | THREE.Points): void => {
    child.geometry?.dispose();
    const { material } = child;
    if (Array.isArray(material)) {
        for (const mat of material) {
            disposeMaterial(mat);
        }
        return;
    }
    if (material) {
        disposeMaterial(material);
    }
};

const disposeSprite = (child: THREE.Sprite): void => {
    if (child.material) {
        disposeMaterial(child.material);
    }
};

const disposeMaterial = (material: THREE.Material): void => {
    material.dispose();
    const textureKeys = [
        'map',
        'lightMap',
        'bumpMap',
        'normalMap',
        'displacementMap',
        'roughnessMap',
        'metalnessMap',
        'alphaMap',
        'envMap',
        'aoMap',
        'emissiveMap',
        'specularMap',
        'gradientMap',
    ] as const;

    const seen = new Set<unknown>();
    const disposeTextureValue = (value: unknown): void => {
        if (!value || typeof value !== 'object') {
            return;
        }
        if (value instanceof THREE.Texture) {
            value.dispose();
            return;
        }
        if (seen.has(value)) {
            return;
        }
        seen.add(value);
        if (Array.isArray(value)) {
            for (const entry of value) {
                disposeTextureValue(entry);
            }
            return;
        }
        for (const entry of Object.values(value as Record<string, unknown>)) {
            disposeTextureValue(entry);
        }
    };

    const materialRecord = material as unknown as Record<string, unknown>;
    for (const key of textureKeys) {
        disposeTextureValue(materialRecord[key]);
    }

    if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
            disposeTextureValue(uniform.value);
        }
    }
};

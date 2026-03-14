import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { disposeObject3D } from '../disposeHelpers';

describe('disposeObject3D', () => {
    it('disposes geometry and material on a mesh', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial();
        const mesh = new THREE.Mesh(geometry, material);

        const geoSpy = vi.spyOn(geometry, 'dispose');
        const matSpy = vi.spyOn(material, 'dispose');

        disposeObject3D(mesh);

        expect(geoSpy).toHaveBeenCalledOnce();
        expect(matSpy).toHaveBeenCalledOnce();
    });

    it('disposes textures attached to materials', () => {
        const texture = new THREE.Texture();
        const material = new THREE.MeshStandardMaterial({ map: texture });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);

        const texSpy = vi.spyOn(texture, 'dispose');

        disposeObject3D(mesh);

        expect(texSpy).toHaveBeenCalledOnce();
    });

    it('handles multi-material meshes', () => {
        const mat1 = new THREE.MeshStandardMaterial();
        const mat2 = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [mat1, mat2]);

        const spy1 = vi.spyOn(mat1, 'dispose');
        const spy2 = vi.spyOn(mat2, 'dispose');

        disposeObject3D(mesh);

        expect(spy1).toHaveBeenCalledOnce();
        expect(spy2).toHaveBeenCalledOnce();
    });

    it('traverses children recursively', () => {
        const parent = new THREE.Group();
        const childGeo = new THREE.SphereGeometry();
        const childMat = new THREE.MeshBasicMaterial();
        const child = new THREE.Mesh(childGeo, childMat);
        parent.add(child);

        const geoSpy = vi.spyOn(childGeo, 'dispose');
        disposeObject3D(parent);
        expect(geoSpy).toHaveBeenCalledOnce();
    });
});

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

    it('disposes geometry and material for lines and points', () => {
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
        const lineMaterial = new THREE.LineBasicMaterial();
        const line = new THREE.Line(lineGeometry, lineMaterial);

        const pointsGeometry = new THREE.BufferGeometry();
        pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        const pointsMaterial = new THREE.PointsMaterial();
        const points = new THREE.Points(pointsGeometry, pointsMaterial);

        const lineGeoSpy = vi.spyOn(lineGeometry, 'dispose');
        const lineMatSpy = vi.spyOn(lineMaterial, 'dispose');
        const pointsGeoSpy = vi.spyOn(pointsGeometry, 'dispose');
        const pointsMatSpy = vi.spyOn(pointsMaterial, 'dispose');

        const parent = new THREE.Group();
        parent.add(line);
        parent.add(points);

        disposeObject3D(parent);

        expect(lineGeoSpy).toHaveBeenCalledOnce();
        expect(lineMatSpy).toHaveBeenCalledOnce();
        expect(pointsGeoSpy).toHaveBeenCalledOnce();
        expect(pointsMatSpy).toHaveBeenCalledOnce();
    });

    it('disposes sprite materials', () => {
        const spriteMaterial = new THREE.SpriteMaterial();
        const sprite = new THREE.Sprite(spriteMaterial);
        const matSpy = vi.spyOn(spriteMaterial, 'dispose');

        disposeObject3D(sprite);

        expect(matSpy).toHaveBeenCalledOnce();
    });

    it('disposes textures referenced by shader uniforms', () => {
        const texture = new THREE.Texture();
        const nestedTexture = new THREE.Texture();
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uNested: { value: { inner: nestedTexture } },
                uTexture: { value: texture },
            },
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);

        const texSpy = vi.spyOn(texture, 'dispose');
        const nestedSpy = vi.spyOn(nestedTexture, 'dispose');

        disposeObject3D(mesh);

        expect(texSpy).toHaveBeenCalledOnce();
        expect(nestedSpy).toHaveBeenCalledOnce();
    });
});

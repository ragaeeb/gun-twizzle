import type * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import basisTranscoderJsUrl from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import basisTranscoderWasmUrl from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';
import dracoDecoderWasmUrl from 'three/examples/jsm/libs/draco/draco_decoder.wasm?url';
import dracoWasmWrapperUrl from 'three/examples/jsm/libs/draco/draco_wasm_wrapper.js?url';

const gltfLoaders = new WeakMap<THREE.WebGLRenderer, GLTFLoader>();
const dracoLoaders = new WeakMap<THREE.WebGLRenderer, DRACOLoader>();
const ktx2Loaders = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();

type DracoLoaderInternal = DRACOLoader & {
    _loadLibrary: (url: string, responseType: 'arraybuffer' | 'text') => Promise<unknown>;
};

type Ktx2LoaderInternal = KTX2Loader & {
    init: () => Promise<void>;
    transcoderPending: Promise<void> | null;
    transcoderBinary?: ArrayBuffer;
    workerSourceURL?: string;
    workerConfig?: unknown;
    workerPool: { setWorkerCreator: (creator: () => Worker) => void };
};

type Ktx2Statics = typeof KTX2Loader & {
    BasisWorker: { toString(): string };
    BasisFormat: unknown;
    EngineFormat: unknown;
    EngineType: unknown;
    TranscoderFormat: unknown;
};

const KTX2 = KTX2Loader as unknown as Ktx2Statics;

const fetchTextOrThrow = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.text();
};

const fetchArrayBufferOrThrow = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.arrayBuffer();
};

const getDracoLoader = (renderer: THREE.WebGLRenderer) => {
    const cached = dracoLoaders.get(renderer);
    if (cached) {
        return cached;
    }

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    const dracoInternal = dracoLoader as DracoLoaderInternal;
    const originalDracoLoadLibrary = dracoInternal._loadLibrary.bind(dracoLoader);
    dracoInternal._loadLibrary = (url, responseType) => {
        if (url === 'draco_wasm_wrapper.js') {
            return fetchTextOrThrow(dracoWasmWrapperUrl);
        }
        if (url === 'draco_decoder.wasm') {
            return fetchArrayBufferOrThrow(dracoDecoderWasmUrl);
        }
        return originalDracoLoadLibrary(url, responseType);
    };

    dracoLoaders.set(renderer, dracoLoader);
    return dracoLoader;
};

const getKtx2Loader = (renderer: THREE.WebGLRenderer) => {
    const cached = ktx2Loaders.get(renderer);
    if (cached) {
        return cached;
    }

    const ktx2Loader = new KTX2Loader();
    ktx2Loader.detectSupport(renderer);
    const ktx2Internal = ktx2Loader as Ktx2LoaderInternal;
    ktx2Internal.init = function init() {
        if (!this.transcoderPending) {
            const jsContent = fetchTextOrThrow(basisTranscoderJsUrl);
            const binaryContent = fetchArrayBufferOrThrow(basisTranscoderWasmUrl);

            this.transcoderPending = Promise.all([jsContent, binaryContent]).then(([jsContent, binaryContent]) => {
                const fn = KTX2.BasisWorker.toString();
                const body = [
                    '/* constants */',
                    `let _EngineFormat = ${JSON.stringify(KTX2.EngineFormat)}`,
                    `let _EngineType = ${JSON.stringify(KTX2.EngineType)}`,
                    `let _TranscoderFormat = ${JSON.stringify(KTX2.TranscoderFormat)}`,
                    `let _BasisFormat = ${JSON.stringify(KTX2.BasisFormat)}`,
                    '/* basis_transcoder.js */',
                    jsContent,
                    '/* worker */',
                    fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}')),
                ].join('\n');

                this.workerSourceURL = URL.createObjectURL(new Blob([body], { type: 'application/javascript' }));
                this.transcoderBinary = binaryContent;

                this.workerPool.setWorkerCreator(() => {
                    const worker = new Worker(this.workerSourceURL!);
                    const transcoderBinary = this.transcoderBinary!.slice(0);
                    worker.postMessage({ config: this.workerConfig, transcoderBinary, type: 'init' }, [
                        transcoderBinary,
                    ]);
                    return worker;
                });
            });
        }

        return this.transcoderPending!;
    };

    ktx2Loaders.set(renderer, ktx2Loader);
    return ktx2Loader;
};

/**
 * Returns a renderer-scoped GLTFLoader configured with Draco, KTX2, and Meshopt decoders.
 */
export const getGLTFLoader = (renderer: THREE.WebGLRenderer): GLTFLoader => {
    const cached = gltfLoaders.get(renderer);
    if (cached) {
        return cached;
    }

    const dracoLoader = getDracoLoader(renderer);
    const ktx2Loader = getKtx2Loader(renderer);

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    gltfLoaders.set(renderer, loader);
    return loader;
};

/**
 * Boot-time assertion: verify all decoder prerequisites are available.
 * Call during the loading screen, before any models are loaded.
 */
export const validateLoaderPrerequisites = async (): Promise<void> => {
    const checks = [
        fetch(dracoWasmWrapperUrl, { method: 'HEAD' }).then((response) => {
            if (!response.ok) {
                throw new Error('Draco JS wrapper not found.');
            }
        }),
        fetch(dracoDecoderWasmUrl, { method: 'HEAD' }).then((response) => {
            if (!response.ok) {
                throw new Error('Draco decoder not found.');
            }
        }),
        fetch(basisTranscoderJsUrl, { method: 'HEAD' }).then((response) => {
            if (!response.ok) {
                throw new Error('Basis transcoder JS not found.');
            }
        }),
        fetch(basisTranscoderWasmUrl, { method: 'HEAD' }).then((response) => {
            if (!response.ok) {
                throw new Error('Basis transcoder not found.');
            }
        }),
    ];
    await Promise.all(checks);
};

/// <reference types="vite/client" />

declare module '*.glb?url' {
    const src: string;
    export default src;
}

declare module '*.glb' {
    const src: string;
    export default src;
}

declare module '*.gltf?url' {
    const src: string;
    export default src;
}

declare module '*.json?url' {
    const src: string;
    export default src;
}

declare module '*.mp3?url' {
    const src: string;
    export default src;
}

declare module '*.webp' {
    const src: string;
    export default src;
}

declare module '*.ktx2' {
    const src: string;
    export default src;
}

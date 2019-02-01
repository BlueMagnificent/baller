

export default class ViewPort {
    /**
     * Creates an instance of ViewPort.
     * @param {Object} scene 
     * @param {Object} camera 
     * @param {Object} renderer 
     * @memberof ViewPort
     */
    constructor(scene, camera, renderer){
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
    }

    /**
     * Render a scene to the viewport based on the scene and camera
     * 
     * @memberof ViewPort
     */
    renderToViewport(){
        this.renderer.render( this.scene, this.camera );
    }
}

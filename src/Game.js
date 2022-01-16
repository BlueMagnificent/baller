// Copyright (c) 2019 BlueMagnificent

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.


import * as THREE from 'three'
import Application from './Application'
import EventType from './libs/EventType'
import RealityBridge from './libs/RealityBridge'
import Stats from './threejs/stats'
import textOverlay from './libs/TextOverlay'
import rc from './libs/ResourceCache';
import * as MISC from './libs/Misc'
import Stage from './libs/Stage'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class Game extends Application{
    constructor(opts = {}){

        super(opts);

        this.pos = new THREE.Vector3();
        this.quat = new THREE.Quaternion();

        this.isPaused = false;
        this.gameOver = false;

        this.currentGameTime = 0;
        this.gameTimeCounter = 0;

        this.inGame = false;

        this.ambientMusic = null;

    }

    /**
     * Initialise the application
     * 
     * @memberof Application
     */
    init(){

        textOverlay.initialize("..Baller..");

        this.stageResources();

        rc.loadResources(this.onResourceLoaded.bind(this), this.onResourceLoadProgress.bind(this));

    }


    /**
     * Stage all the necessary resources/assets to be loaded
     * 
     * @memberof Game
     */
    stageResources(){



        this.gltfLoader = new GLTFLoader();
        rc.stageForLoading(this.gltfLoader.load.bind(this.gltfLoader), "assets/baller_base/baller_base.gltf", "baller_base");

        this.audioLoader = new THREE.AudioLoader();
        rc.stageForLoading(this.audioLoader.load.bind(this.audioLoader), "assets/audio/pulse.ogg", "delay_sound");
        rc.stageForLoading(this.audioLoader.load.bind(this.audioLoader), "assets/audio/spirit-of-the-girl.ogg", "ambient_sound");

        this.textureLoader = new THREE.TextureLoader();
        rc.stageForLoading(this.textureLoader.load.bind(this.textureLoader), "assets/texture/ball_diffuse.jpg", "ball_diffuse");
        rc.stageForLoading(this.textureLoader.load.bind(this.textureLoader), "assets/texture/ball_normal.jpg", "ball_normal");
        rc.stageForLoading(this.textureLoader.load.bind(this.textureLoader), "assets/texture/ball_specular.jpg", "ball_specular");
        rc.stageForLoading(this.textureLoader.load.bind(this.textureLoader), "assets/texture/dot.png", "dot");


    }
    

    /**
     * Called when all resources have been loaded
     * 
     * @param {Error} err Error parameter. This value is set if there is any error
     * @returns nothing
     * @memberof Game
     */
    async onResourceLoaded(err){

        //if there was an error then return
        if(err) return console.log(err);

        try {

            this.createScene();
            await this.bridgeReality();
            
            this.createStage();

            this.createRenderer();
            this.createInitialViewport();
            this.subscribeToEvents();

            this.stats = new Stats();
            this.domParent.appendChild( this.stats.dom );
            

            textOverlay.showGameInstruction();
            
            //
            
        } catch (error) {

            console.log(error.message);

        }

    }

    /**
     * Load progress event handler
     * 
     * @param {Number} currProgress progress of the current asset being loaded
     * @param {Number} totalProgress Cummulative progress of all the assets being loaded
     * @param {String} resourceUrl The URL of the current resource being loaded
     * 
     * @memberof Game
     */
    onResourceLoadProgress(currProgress, totalProgress, resourceUrl){

        textOverlay.updateLoadingDisplay(totalProgress, `Loading "${resourceUrl}" : ${currProgress}%`);

    }


    /**
     * Create the the default Scene
     * 
     * @memberof Application
     */
    createScene(){
        

        let scene = this.scene = new THREE.Scene();
        scene.background = new THREE.Color().setHSL( 0.1, 0.1, 0.1 );
        scene.fog = new THREE.Fog( scene.background, 1, 5000 );


        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 5000 );
        
        this.setupSoundSystem(this.camera);

        // LIGHTS

        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.1 );
        hemiLight.color.setHSL( 0.6, 0.6, 0.6 );
        hemiLight.groundColor.setHSL( 0.1, 1, 0.4 );
        hemiLight.position.set( 0, 50, 0 );
        scene.add( hemiLight );

        let dirLight = this.dirLight = new THREE.DirectionalLight( 0xffffff , 1);
        dirLight.color.setHSL( 0.1, 1, 0.95 );
        dirLight.position.set( -1, 1.75, 1 );
        dirLight.position.multiplyScalar( 100 );
        scene.add( dirLight );

        dirLight.castShadow = true;

        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;

        let d = 50;

        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;

        dirLight.shadow.camera.far = 13500;

    }

    /**
     * Setup the sound system
     * 
     * @param {any} camera viewport camera
     * @returns null
     * @memberof Game
     */
    setupSoundSystem(camera){

        if(camera === undefined) return;

        let listener = this.listener = new THREE.AudioListener();
        camera.add( listener );

        let ambientMusic = this.ambientMusic = new THREE.Audio( listener );
        let buffer = rc.getResource('ambient_sound');
        ambientMusic.setBuffer( buffer );
        
        ambientMusic.setVolume( 0.5 );
        ambientMusic.setLoop( true );

    }

    /**
     * Initialise the Reality Bridge ;)
     * 
     * @memberof Game
     */
    async bridgeReality(){

        this.realityBridge = null;

        if(this.scene !== null)
        {
            this.realityBridge = new RealityBridge(this);
            
            await this.realityBridge.startReality({}, true);
            await this.realityBridge.set( {gravity: [0, -250, 0]} );
            await this.realityBridge.updateReality();
            
        }
    }


    /**
     * Create Game Stage
     * 
     * @memberof Game
     */
    createStage(){

        this.gameStage = new Stage({
                scene : this.scene,
                camera : this.camera,
                realityBridge : this.realityBridge,
                resourceCache : rc,
                listener : this.listener,
                gameOverCallBack: this.gameOverCallBack.bind(this)
            });

    }



    /**
     * Create the renderer for the application
     * 
     * @memberof Application
     */
    createRenderer(){

        let renderer = this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        renderer.setClearColor( 0xbfd1e5 );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        this.domParent.appendChild( this.renderer.domElement );

        renderer.gammaInput = true;
        renderer.gammaOutput = true;

        renderer.shadowMap.enabled = true;
    }

    /**
     * Create the primary render viewport
     * 
     * @memberof Game
     */
    createInitialViewport(){

        this.mainViewport = this.addViewport(this.scene, this.camera, this.renderer);

    }

    


    /**
     * Begin the render loop of the application
     * 
     * @memberof Game
     */
    startGame(){


        this.gameStage.start(()=>{

            
            this.gameOver = false;
            this.isPaused = false;
            
            textOverlay.showGameViewOverlay();
            this.initialiseGameTime();

            this.runRenderLoop();

        })

    }

    /**
     * init Game Time
     * 
     * @memberof Game
     */
    initialiseGameTime(){


        this.updateGameTime(0);
        this.gameTimeCounter = 0;

    }



    /**
     * Restart the game
     * 
     * @memberof Game
     */
    restartGame(){

        this.gameStage.restart(()=>{
        
            this.gameOver = false;
    
            textOverlay.hidePauseDisplay();
            this.initialiseGameTime();
    

        });

    }


    
    lockMousePointer(){

        if(document.pointerLockElement !== this.domParent && document.mozPointerLockElement !== this.domParent) {
              
            this.domParent.requestPointerLock();

        }

    }

    /**
     * Method to be called back when the game is completed
     * 
     * @param {boolean} [win=false] win status
     * @memberof Game
         */
    gameOverCallBack( win = false ){

        //if win = true do something
        if( win ){

            this.gameOver = true;
            this.inGame = false;

            textOverlay.showGameOver();

            console.log('Game Over');

        }
        //else do something different

    }


    /**
     * Subscribe to events needed in the application
     * 
     * @memberof Application
     */
    subscribeToEvents(){

        this.subscribeToEvent(EventType.EVT_UPDATE, this.handleUpdate.bind(this));
        this.subscribeToEvent(EventType.EVT_WINDOW_RESIZE, this.handleWindowResize.bind(this));
        this.subscribeToEvent(EventType.EVT_KEY_DOWN, this.handleKeyDown.bind(this));
        this.subscribeToEvent(EventType.EVT_POST_UPDATE, this.handlePostUpdate.bind(this));
        this.subscribeToEvent(EventType.EVT_MOUSE_MOVE, this.handleMouseMove.bind(this));


        //add pointerlockchange event handler as gotten from MDN
        if ("onpointerlockchange" in document) {

            document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this), false);

        } else if ("onmozpointerlockchange" in document) {

            document.addEventListener('mozpointerlockchange',  this.handlePointerLockChange.bind(this), false);

        }

    }


    /**
     * Handles pre-render update
     * 
     * @param {Object} eventData Event Data passed to the method
     * @memberof Application
     */
    handleUpdate(eventData){

        if(this.inGame && !this.isPaused) {
            
            //Update the game timer
            let timeStep = eventData.timeStep;

            this.gameTimeCounter += timeStep;

            if(this.gameTimeCounter >= 1){
                
                this.updateGameTime(this.currentGameTime + 1);
                this.gameTimeCounter = 0;

            }

            //Update the game stage
            this.gameStage.handleUpdate(eventData);

        }

    }


    /**
     * Handle post update
     * 
     * @memberof Game
     */
    handlePostUpdate(){

        this.stats.update();

    }


    /**
     * Handle mouse move event
     * 
     * @param {Object} eventData object that contains relevant event details
     * @memberof Game
     */
    handleMouseMove(eventData){

        if(this.inGame && !this.isPaused) this.gameStage.handleMouseMove(eventData);

    }
    

    /**
     * Handles instances where the browser window is resized
     * 
     * @memberof Application
     */
    handleWindowResize(){

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );

    }



    /**
     * Handle keydown event
     * 
     * @param {Object} eventData Event Data passed to the method
     * @memberof Application
     */
    handleKeyDown(eventData){


        if(this.inGame){

            this.inGameKeyDownHandler(eventData);

        } 
        else{

            this.outGameKeyDownHandler(eventData);

        }


    }

    /**
     * Key down handler where inGame = false;
     * 
     * @param {any} eventData Event data object
     * @memberof Game
     */
    outGameKeyDownHandler(eventData){


        switch ( eventData.keyCode ) {
            case 32: // space key
                //if the game has been played before restart()  else start()
                if(this.gameOver){

                    textOverlay.showGameViewOverlay();
                    textOverlay.hidePauseDisplay();
                    textOverlay.hideGameOver();

                    this.restartGame();
                }
                else
                {

                    this.lockMousePointer();
                    this.ambientMusic.play();
                    this.startGame();

                }

                this.inGame = true;
                break;

        }

    }
    

    /**
     * Key down event handler where inGame = true
     * 
     * @param {any} eventData Event data object
     * @memberof Game
     */
    inGameKeyDownHandler(eventData){

        switch ( eventData.keyCode ) {
            case 80: //P key to toggle game pause
                this.toggleGamePause();
                break;

            case 32: //Space key to restart game
                if(this.isPaused){
                    this.toggleGamePause();
                    this.restartGame();
                }
                break;
            default: // any other key should be forwarded to Stage if game is not paused
                if(!this.isPaused) this.gameStage.handleKeyDown(eventData);
        }

    }
    
    /**
     * Pointer lock change event andler
     * 
     * @memberof Game
     */
    handlePointerLockChange(){

        //handle only when we've lost the pointer lock
        if(document.pointerLockElement !== this.domParent && document.mozPointerLockElement !== this.domParent){

            if(!this.isPaused){

                this.toggleGamePause();

            } 

        } 

    }
    

    updateGameTime(timeValue){

        this.currentGameTime = timeValue;
        let gameTimeText = MISC.intToTimeString(this.currentGameTime);

        textOverlay.updateTimeDisplay(gameTimeText);

    }


    toggleGamePause(){

        this.isPaused = !this.isPaused;

        if(this.isPaused) textOverlay.showPauseDisplay();
        else{

            textOverlay.hidePauseDisplay();

            //regain pointer lock just incase it was lost through pressing ESC
            this.lockMousePointer();

        }

    }
    


}

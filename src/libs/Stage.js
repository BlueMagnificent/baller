/**
 * Game Stage Class
 * 
 * 
 */

import * as THREE from 'three'
import * as MISC from './Misc'
import CamControl from './CamControl'
import Proton from 'imports-loader?THREE=THREE!./ProtonPlus'


export default class Stage {

    constructor({scene = null, camera = null, realityBridge = null, resourceCache = null, listener = null, gameOverCallBack = null}){

        if( scene === null || camera === null || realityBridge === null, resourceCache === null, listener === null, gameOverCallBack === null ) throw Error("Incomplete initialisation paramters");
        
        this.scene = scene;
        this.realityBridge = realityBridge;
        this.rc = resourceCache;
        this.listener = listener;
        this.gameOverCallBack = gameOverCallBack;

        this.isSimulating = false;

        this.delayContactCbCheck = 0; //0: Ok to run; 1: Instance is currently running; 2: action has been posted to endpoint



        this.setupPlayer(camera);
        this.setupSound(listener);
        
        this.playerHasUpdate = false;

        this.rotDeterminant = [ 
                {axis: 'x', direction: 1} ,
                {axis: 'z', direction: 1} ,
                {axis: 'x', direction: -1} ,
                {axis: 'z', direction: -1} 
            ];
        
        this.rotDeterminantCursor = 0;

        //temp values
        this.pos = new THREE.Vector3();
        this.quat = new THREE.Quaternion();

        
        this.ballerBasePhysicsName = "bb";
        this.rollingBallPhysicsName = "rb";
        this.delayObstaclePhysicsName = "do";
        this.homeObjectPhysicsName = "ho";

        this.ballDelayContactName = "ctbd";
        this.ballHomeContactName = "ctbh";

        this.ballMass = 2;

        this.obstacles = [{name:"ob1",pos:[8.074526,0.6,11.857162],scale:[0.6,1.4,5.179307]},{name:"ob2",pos:[1.908815,0.6,6.112903],scale:[0.6,1.4,8.980436]},{name:"ob3",pos:[8.417303,0.599999,5.926694],scale:[12.431125,1.4,0.6]},{name:"ob4",pos:[-4.564306,0.6,-1.919216],scale:[19.636231,1.4,0.6]},{name:"ob5",pos:[6.381232,0.6,-8.360071],scale:[8.756301,1.4,0.6]},{name:"ob6",pos:[6.189222,0.6,-12.406277],scale:[0.6,1.4,3.973]},{name:"ob7",pos:[-9.018096,0.6,-8.399204],scale:[10.819665,1.4,0.6]},{name:"ob8",pos:[-7.182541,0.6,-12.376284],scale:[0.6,1.4,3.973096]}];
        this.delayObstacles = [{name:"dob1",pos:[-8.126742,0.6,7.723256],scale:[12.552326,1.4,0.6]},{name:"dob2",pos:[-3.200462,0.6,4.036478],scale:[9.583503,1.4,0.6]},{name:"dob3",pos:[8.967835,0.6,-1.19023],scale:[0.6,1.4,7.596193]},{name:"dob4",pos:[-7.557407,0.6,-4.21888],scale:[0.6,1.4,3.973096]},{name:"dob5",pos:[-0.825243,0.6,-7.89795],scale:[0.6,1.4,6.541291]}];
        this.stagePhysicsData = [{name:"base",pos:[0,-5,0],scale:[30,10,30]},{name:"north_wall",pos:[0,0.7,-14.7],scale:[28.8,1.4,0.6]},{name:"south_wall",pos:[0,0.7,14.7],scale:[28.8,1.4,0.6]},{name:"east_wall",pos:[14.7,0.7,0],scale:[0.6,1.4,28.8]},{name:"west_wall",pos:[-14.7,0.7,0],scale:[0.6,1.4,28.8]},{name:"top_cover",pos:[0,3,0],scale:[30,2,30]}];

        this.boxBuff = new THREE.BoxBufferGeometry();
        this.proton = new Proton();

    }
    

    /**
     * Setup the player which is actually the camera view
     * 
     * @param {Camera} camera viewing camera
     * @memberof Stage
     */
    setupPlayer(camera){

        //The player
        this.player = new THREE.Group();
        this.playerPitchNode = new THREE.Group();
        this.playerRollNode = new THREE.Group();

        this.playerPitchNode.add(this.playerRollNode);
        this.player.add(this.playerPitchNode);

        this.scene.add(this.player);


        this.camController = new CamControl(camera)
        this.camInTransition = false;
        this.player.add(this.camController);


        this.playerPitch = 0;
        this.playerRoll = 0;

    }



    /**
     * Setup the sound listener
     * 
     * @param {AudioListener} listener Audio listener for the sound
     * @memberof Stage
     */
    setupSound(listener){

        let sound = this.sound = new THREE.Audio( listener );
        let buffer = this.rc.getResource('delay_sound');
        sound.setBuffer( buffer );
        
        sound.setVolume( 0.5 );

    }




    async start( cb ){

        await this.realityBridge.startReality({}, true);


        await this.realityBridge.set( {gravity: [0, -250, 0]} );
        await this.realityBridge.updateReality();

        
        this.loadBallerBase();
        await this.createStagePhysics();
        await this.createBallPhysics();

        await this.createDelayObstacle();
        await this.createHomeObject();

    
        await this.realityBridge.setContactPairCheck({name: this.ballDelayContactName, b1: this.rollingBallPhysicsName, b2: this.delayObstaclePhysicsName, f: this.onHitDelayObstacle.bind(this)});
        await this.realityBridge.setContactPairCheck({name: this.ballHomeContactName, b1: this.rollingBallPhysicsName, b2: this.homeObjectPhysicsName, f: this.onHitHomeObject.bind(this)});


        cb();

    }




    

    /**
     * Load the mesh object for the stage base
     * 
     * @memberof Stage
     */
    loadBallerBase(){

        let ballerBase = this.ballerBase =  this.rc.getResource("baller_base").scene.children[0].clone();

        ballerBase.position.fromArray([0, 0.06999 ,0]);

        ballerBase.receiveShadow = true;
        ballerBase.visible = true;

        this.playerRollNode.add(ballerBase);

    }

    /**
     * Create the physics body for the stage
     * 
     * @memberof Stage
     */
    createStagePhysics(){

        let shapes = [];
        let quat = [0, 0, 0, 1];

        this.stagePhysicsData.forEach((obj)=>{
            
            let pos = obj.pos;
            let size = obj.scale;

            shapes.push({ type:'box', size, pos, quat })

        });

        this.createObstacle(shapes);


        return this.realityBridge.add({
                type : 'compound',
                name : this.ballerBasePhysicsName,
                shapes,
                friction: 0.5,
                kinematic : true,
                mass : 0
            });

    }


    /**
     * Create obstacle walls for the stage
     * 
     * @param {Array} shapes an array for shapes for the compound physics ridigbody
     * @memberof Stage
     */
    createObstacle(shapes){
        
        let pos = new THREE.Vector3();
        let scale = new THREE.Vector3();
        let quat = [0, 0, 0, 1];

        let mesh = new THREE.Mesh(this.boxBuff, new THREE.MeshPhongMaterial({color: 0x2c3636}));

        this.obstacles.forEach(obstacle=>{

            let obstacleMesh = mesh.clone();

            pos.fromArray(obstacle.pos);
            obstacleMesh.position.copy(pos);

            scale.fromArray(obstacle.scale);
            obstacleMesh.scale.copy(scale);

            obstacleMesh.castShadow = true;

            this.playerRollNode.add(obstacleMesh);

            shapes.push({type: "box", size: scale.toArray(), pos: pos.toArray(), quat});

        });

    }

    /**
     * Create the obstacles that will delay the player when hit
     * 
     * @memberof Stage
     */
    createDelayObstacle(){

        let shapes = [];
        let pos = new THREE.Vector3();
        let scale = new THREE.Vector3();
        let quat = [0, 0, 0, 1];

        let mesh = new THREE.Mesh(this.boxBuff, new THREE.MeshPhongMaterial({color: 0x7A0408}));

        this.delayObstacles.forEach(obstacle=>{

            let obstacleMesh = mesh.clone();

            pos.fromArray(obstacle.pos);
            obstacleMesh.position.copy(pos);

            scale.fromArray(obstacle.scale);
            obstacleMesh.scale.copy(scale);

            obstacleMesh.castShadow = true;

            this.playerRollNode.add(obstacleMesh);

            shapes.push({type: "box", size: scale.toArray(), pos: pos.toArray(), quat});

        });

        return this.realityBridge.add({
                type : 'compound',
                name : this.delayObstaclePhysicsName,
                shapes,
                kinematic : true,
                mass : 0
            });

    }


    /**
     * Create physics for the rolling ball
     * 
     * @memberof Stage
     */
    createBallPhysics(){

        //Create the rolling ball
        let ballRadius = 0.6;
        let posArray = [11, 0.6, 11];

        let sphereGeom = new THREE.SphereBufferGeometry(ballRadius, 20, 8);

        let diffuseTex =  this.rc.getResource("ball_diffuse");
        let normalTex =  this.rc.getResource("ball_normal");
        let specularTex =  this.rc.getResource("ball_specular");
        

        let ballMat = new THREE.MeshPhongMaterial({map: diffuseTex, normalMap: normalTex, specularMap: specularTex, shininess: 153});

        let ball = this.ball = new THREE.Mesh(sphereGeom, ballMat);

        ball.castShadow = true;

        this.scene.add(ball);
        ball.position.set(posArray[0], posArray[1], posArray[2]);


        return this.realityBridge.add({
            type: 'sphere',
            name: this.rollingBallPhysicsName,
            body: ball,
            size: [ballRadius, ballRadius, ballRadius],
            pos: posArray,
            mass: this.ballMass,
            friction: 0.5,
            linear: 0.5,
            rolling: 0.3
        });

    }


    createHomeObject(){

        let radius = 1;


        let emitNode = this.emitNode = new THREE.Group();
        emitNode.position.set(-12.5, 1, -12.5);
        emitNode.scale.set(0.2, 0.2, 0.2)
        this.playerRollNode.add(emitNode);

        

        var ar = Array.from(new THREE.SphereBufferGeometry().getAttribute('position').array);
        var vertexBuffer = [];
        for(var i = 0; i < ar.length; i += 3){
            vertexBuffer.push({x: ar[i], y: ar[i + 1], z: ar[i + 2]})
        }
        let mesh =  {geometry: {vertices: vertexBuffer} };
        
        this.proton.addEmitter(this.createEmitter(emitNode, mesh));
        this.proton.addRender(new Proton.SpriteRender( this.scene));



        //Create physics
        let shapes = [];
        let quat = [0, 0, 0, 1];
        shapes.push({type: "sphere", size: [radius, radius, radius], pos: emitNode.position.toArray(), quat});

        return this.realityBridge.add({
            type : 'compound',
            name : this.homeObjectPhysicsName,
            shapes,
            kinematic : true,
            mass : 0
        });



    }


    
    createSprite() {
        var map = this.rc.getResource("dot");
        var material = new THREE.SpriteMaterial({
            map: map,
            color: 0xff0000,
            blending: THREE.AdditiveBlending,
            fog: true
        });
        return new THREE.Sprite(material);
    }


    createEmitter(refnode, mesh) {

        let emitter = this.emitter = new Proton.AdvEmitter(refnode);
        emitter.rate = new Proton.Rate(new Proton.Span(1, 3), new Proton.Span(.02));
        //addInitialize
        emitter.addInitialize(new Proton.Position(new Proton.MeshZone(mesh, 5)));
        emitter.addInitialize(new Proton.Mass(1));
        emitter.addInitialize(new Proton.Radius(1, 3));
        emitter.addInitialize(new Proton.Life(0.6));
        emitter.addInitialize(new Proton.Body(this.createSprite()));

        //addBehaviour
        let randomBehaviour = new Proton.RandomDrift(0.1, 0.1, 0.1);
        let gravity = new Proton.Gravity(0);
        
        emitter.addBehaviour(gravity);
        emitter.addBehaviour(randomBehaviour);
        emitter.addBehaviour(new Proton.Color(['#00aeff', '#0fa954', '#54396e', '#e61d5f']));
        emitter.addBehaviour(new Proton.Color('random'));

        emitter.p.x = 0;
        emitter.p.y = 0;
        emitter.p.z = 0;
        emitter.emit();
        

        return emitter;
    }


    async restart( cb ){
        
        await this.realityBridge.clearAllContact();

        await this.realityBridge.remove({name: this.rollingBallPhysicsName});

        this.rotDeterminantCursor = 0;

        this.playerPitch = 0;
        this.playerRoll = 0;

        this.playerPitchNode.rotation.set(0, 0, 0);
        this.playerRollNode.rotation.set(0, 0, 0);
        

        let pos = [0, 0, 0];
        let quat = [0, 0, 0, 1];

        let matrixArray = [];

        matrixArray.push([this.ballerBasePhysicsName, pos, quat]);
        matrixArray.push([this.delayObstaclePhysicsName, pos, quat]);
        matrixArray.push([this.homeObjectPhysicsName, pos, quat]);

        await this.realityBridge.setMatrixArray(matrixArray);

        await this.realityBridge.updateReality(null, true);


        // recreate ball physics
        let ballRadius = 0.6;
        let posArray = [11, 0.6, 11];

        
        this.ball.rotation.set(0, 0, 0);
        this.ball.position.fromArray(posArray);

        await this.realityBridge.add({
            type: 'sphere',
            name: this.rollingBallPhysicsName,
            body: this.ball,
            size: [ballRadius, ballRadius, ballRadius],
            pos: posArray,
            mass: this.ballMass,
            friction: 0.5,
            linear: 0.5,
            rolling: 0.3
        });
        
        await this.realityBridge.setContactPairCheck({name: this.ballDelayContactName, b1: this.rollingBallPhysicsName, b2: this.delayObstaclePhysicsName, f: this.onHitDelayObstacle.bind(this)});
        await this.realityBridge.setContactPairCheck({name: this.ballHomeContactName, b1: this.rollingBallPhysicsName, b2: this.homeObjectPhysicsName, f: this.onHitHomeObject.bind(this)});
        
        //reset the camera perspective
        this.camController.resetPerspective();

        cb();

    }
    

    /**
     * Handle when there is contact between the rolling ball and delay obstacle
     * 
     * @param {Boolean} status True when there is a contact and False if otherwise
     * @memberof Stage
     */
    async onHitDelayObstacle(status){

        if(!status) return;

        //to prevent being called when an already called instance has not yet finished executing
        if(this.delayContactCbCheck === 1 || this.delayContactCbCheck === 2) return;

        if(this.sound.isPlaying) this.sound.stop();

        this.sound.play();

        this.pos.set(11, 0.6, 11);
        let posArray = this.ballerBase.localToWorld(this.pos).toArray();// [11, 0.6, 11];
        let quatArray = [0, 0, 0, 1];

        await this.realityBridge.setMatrix([this.rollingBallPhysicsName, posArray, quatArray]);

        this.delayContactCbCheck = 2

    }


    onHitHomeObject(status){

        if(!status) return;

        this.gameOverCallBack(true);

    }



    /**
     * Handles pre-render update
     * 
     * @param {Object} eventData Event Data passed to the method
     * @memberof Application
     */
    async handleUpdate(eventData){

        //update proton
        this.proton.update();

        //rotate the home object
        this.emitNode.rotateX(MISC.deg2Rad * 3);

        if(this.isSimulating === true) return;

        //stop any instance of this function from executing while physics simulation is going on
        this.isSimulating = true;

        //Get the time stamp value
        let timeStep = eventData.timeStep;


        //run update for the camera controller
        this.camController.handleUpdate(eventData);

        //update player transform if player has update and there is no pending delay contact action
        if(this.delayContactCbCheck === 0 && this.playerHasUpdate) await this.updatePlayerTransform();


        //lastly, step the physics world
        await this.realityBridge.updateReality(timeStep);

        
        if( this.delayContactCbCheck === 2 ) this.delayContactCbCheck = 0;
        
        this.isSimulating = false;

    }


    /**
     * Handle keydown event
     * 
     * @param {Object} eventData Event Data passed to the method
     * @memberof Application
     */
    handleKeyDown(eventData){

        switch ( eventData.keyCode ) {
            case 65: // a
                this.turnCamController(false)
                break;

            case 68: // d
                this.turnCamController(true)
                break;

        }

    }

    handleMouseMove(eventData){

        if(this.camInTransition !== false || this.playerHasUpdate  === true ) return;

        let rotDet = this.rotDeterminant[this.rotDeterminantCursor];
        let moveScaleFactor = 0.3;

        let pitch = eventData.movementY * rotDet.direction * moveScaleFactor;
        let roll = eventData.movementX * rotDet.direction * moveScaleFactor;
        
        //Swapping with destructured arrays
        if(rotDet.axis === 'z') [pitch, roll] = [-roll, pitch]

        this.rotatePlayer(pitch, roll);

    }

    handleChangedCamView( moveRight ){

        if(moveRight === undefined || typeof moveRight !== 'boolean') moveRight = true;

        let direction = moveRight ? 1 : -1
        this.rotDeterminantCursor = this.rotDeterminantCursor + direction;

        //ensure the cursor loops round
        if(this.rotDeterminantCursor < 0 ) this.rotDeterminantCursor = 3
        else if(this.rotDeterminantCursor > 3) this.rotDeterminantCursor = 0 


    }

    
    rotatePlayer(pitch, roll){

        this.playerPitch = pitch;
        this.playerRoll = -roll;

        this.playerHasUpdate = true;
        
    }
    

    turnCamController(right){

        if( this.camInTransition ) return;

        if( right === null || right === undefined || typeof right !== "boolean") right = true;
        
        this.camInTransition = true;

        if(right)  this.camController.turnRight(()=>{ this.camInTransition = false;});
        else this.camController.turnLeft(()=>{ this.camInTransition = false;});

        this.handleChangedCamView(right);

    }

    
    
    updatePlayerTransform(){

        //cap the rotation values to avoid extreme angles
        let x = this.playerPitchNode.rotation.x;
        let z = this.playerRollNode.rotation.z;


        let rotateXValue = Math.abs( x + MISC.deg2Rad  * this.playerPitch * 0.2 ) > 0.116 ? 0 : MISC.deg2Rad  * this.playerPitch * 0.2;
        let rotateZValue = Math.abs( z + MISC.deg2Rad  * this.playerRoll * 0.2 ) > 0.116 ? 0 : MISC.deg2Rad  * this.playerRoll * 0.2;

        this.playerPitchNode.rotateX( rotateXValue);
        this.playerRollNode.rotateZ( rotateZValue );

        this.ballerBase.getWorldQuaternion(this.quat);
        this.ballerBase.getWorldPosition(this.pos);
        
        let pos = [0, 0, 0];

        let matrixArray = [];

        matrixArray.push([this.ballerBasePhysicsName, pos, this.quat.toArray()]);
        matrixArray.push([this.delayObstaclePhysicsName, pos, this.quat.toArray()]);
        matrixArray.push([this.homeObjectPhysicsName, pos, this.quat.toArray()]);

        this.playerHasUpdate = false;

        return this.realityBridge.setMatrixArray(matrixArray);

        
    }



}
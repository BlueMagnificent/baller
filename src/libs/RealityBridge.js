/**
 * Reality-Bridge by "Blue, The Magnificent"
 * 
 *                  DERIVED FROM
 * 
 * Ammo Init (AMMO worker launcher) by lo.th / http://lo-th.github.io/labs/
 * 
 * 
 **/


import * as THREE from 'three'

export default class RealityBridge {
    constructor(parent){

        this.parent = parent;
        this.scene = parent.scene;
        this.physicsWorker = null;

        this.resetOrInitialiseWorld();
        this.setupInitialVariables();
        this.setupPhysicsWorker();

        this.contactsId = 0

    }


    resetOrInitialiseWorld(){
        
        this.extraGeo = [];
        this.solids  = [];
        this.bodys = [];
        
        this.contacts = [];
        this.contactCallback = [];

        this.timeSpan = 0;

        this.byName = {};

        this.canStepSimulation = false;

    }
    
    setupInitialVariables(){

        this.worker = null;
        this.blob = null;

        this.timestep = 1/60;
        this.substep = 2; //7;

        this.debug = false;
        this.gravity  = [0, 0, 0];


        //just a hack to keep things in order
        //should be removed later
        this.user = {key: 2};
        
        let  ArLng = this.ArLng = [ 
            1000 * 8, // rigid
            100 * 4, // joint
        ];
        
        this.ArPos = [ 
            0, 
            ArLng[0],
        ];
        
        this.ArMax = ArLng[0] + ArLng[1];
    }



    setupPhysicsWorker(){

        this.physicsWorker = Comlink.proxy(new Worker('./js/ammo.worker.js'));
        
    }
    
    startReality(o, debug){

        o = o || {};
        
        if(o.gravity) this.gravity = o.gravity;

        this.debug = debug || false;

        this.blob = document.location.href.replace(/\/[^/]*$/,"/") + "./js/ammo.wasm.js" ;

        
        return new Promise(resolve=>{

            this.physicsWorker.init({ blob: this.blob, debug: this.debug, timestep: this.timestep, substep: this.substep, settings: [ this.ArLng, this.ArPos, this.ArMax ] })
            .then(()=>{

                window.URL.revokeObjectURL( this.blob );
                this.blob = null;

                this.canStepSimulation = true;

                resolve(true);

            })

        })
        
    }



    updateReality(timeStep, forceStep){

        this.timeSpan += forceStep ? 1/60 : (timeStep || 1/60);


        
        return new Promise(resolve=>{

            if(!this.canStepSimulation && !forceStep){

                resolve(false);
            }
            else{

                this.canStepSimulation = false;
                this.timeSpan = 0;
                
                this.physicsWorker.step( { key: this.user.key, timeStep: this.timeSpan} )
                .then(( o )=>{

                    if( o.status === true ) this.step( o );

                    resolve(true)

                });
            }


        })


    }

    resetPhysicsObjects(){

        return this.physicsWorker.reset({});

    }
    

    set ( o ){

        return this.physicsWorker.setWorldParameter( o );

    }


    step ( o ) {

        let Ar = o.Ar;
        let contacts = o.contacts;

        let ArPos = this.ArPos;

        this.bodyStep( Ar, ArPos[0] );

        this.updateContact( contacts );

        this.canStepSimulation = true;
        
    }


    setContactPairCheck(o){

        o.name = o.name || `ct${this.contactsId++}`;
        this.contactCallback.push({name: o.name, f: o.f}); delete(o.f); 

        return this.physicsWorker.addContact( o );

    }



    clearContact(o){

        if( !o.name ) return new Promise(resolve=>resolve(false));

        return new Promise(resolve=>{

            this.physicsWorker.clearContact( o )
            .then(status=>{

                if(status) {

                    this.contactCallback = this.contactCallback.filter( ct => ct.name !== o.name);

                    resolve(true);

                }
                else{

                    resolve(false)

                }

            })

        }) 


    }


    clearAllContact(){

        return new Promise(resolve=>{

            this.physicsWorker.clearAllContact()
            .then(status=>{

                if(status) {

                    this.contactCallback = [];
                    resolve(true)

                }
                else{

                    resolve(false);
                    
                }

            })

        }) 

    }



    updateContact ( contacts ) {

        this.contactCallback.forEach( ( ct, id ) => {

            ct.f( contacts[id] || 0 );

        });

    }

    bodyStep( AR, N ){

        if( !this.bodys.length ) return;
    
        this.bodys.forEach( function( b, id ) {
    
            let n = N + ( id * 8 );
            let s = AR[n];
            if ( s > 0 ) {
                
                b.position.fromArray( AR, n + 1 );
                b.quaternion.fromArray( AR, n + 4 );
    
            }

        });
    
    }
    


    setMatrix ( o ){

        return this.physicsWorker.matrix( o );

    }

    setMatrixArray ( o ){

        return this.physicsWorker.matrixArray( o );

    }

        
    //--------------------------------------
    //   RIGIDBODY
    //--------------------------------------


    add ( o ) {

        o.type = o.type === undefined ? 'box' : o.type;
        
        let isKinematic = o.kinematic !== undefined ? o.kinematic : false;

        if( o.density !== undefined ) o.mass = o.density;
        else o.density = o.mass;

        o.mass = o.mass === undefined ? 0 : o.mass;
        
        let moveType = 1;
        if( o.move !== undefined ) moveType = 0;// dynamic
        //if( o.density !== undefined ) moveType = 0;
        if( o.mass !== 0 ) moveType = 0;
        if( isKinematic ) moveType = 2;


        // position
        o.pos = o.pos == undefined ? [0,0,0] : o.pos;

        // size
        o.size = o.size == undefined ? [1,1,1] : o.size;
        if(o.size.length == 1){ o.size[1] = o.size[0]; }
        if(o.size.length == 2){ o.size[2] = o.size[0]; }


        // rotation is in degree
        o.rot = o.rot == undefined ? [0,0,0] : Math.vectorad(o.rot);
        o.quat = new THREE.Quaternion().setFromEuler( new THREE.Euler().fromArray( o.rot ) ).toArray();

        if(o.rotA) o.quatA = new THREE.Quaternion().setFromEuler( new THREE.Euler().fromArray( Math.vectorad( o.rotA ) ) ).toArray();
        if(o.rotB) o.quatB = new THREE.Quaternion().setFromEuler( new THREE.Euler().fromArray( Math.vectorad( o.rotB ) ) ).toArray();

        if(o.angUpper) o.angUpper = Math.vectorad( o.angUpper );
        if(o.angLower) o.angLower = Math.vectorad( o.angLower );


        let mesh = o.body || new THREE.Object3D();

        if(o.type.substring(0,5) === 'joint') {

            return this.physicsWorker.add( o );

        }

        if(o.type === 'plane'){

            this.grid.position.set( o.pos[0], o.pos[1], o.pos[2] )

            return this.physicsWorker.add( o );

        }


        //Terrain is disabled for now
        // if(o.type === 'terrain'){
        //     return this.terrain( o ); 
        // }
    
        
        if( o.body ) delete ( o.body );
        

        // static
        if( moveType === 1 && !isKinematic ) this.solids.push( mesh );
        // dynamique
        else this.bodys.push( mesh );

        if( o.name ) this.byName[ o.name ] = mesh;

        return this.physicsWorker.add( o );

    }


    remove ( o ){

        this.removeMesh( o );

        return this.physicsWorker.remove( o );

    }


    removeArray ( o ){

        if( !Array.isArray(o)) new Promise(resolve=>resolve(true));

        o.forEach(obj => removeMesh( obj ));

        return this.physicsWorker.removeArray( o );

    }


    removeMesh( o ){

        if( o.name === undefined || o.name === '') return;

        let mesh = this.byName[ o.name ] || null;
    
        if( mesh === null) return;
    
        delete this.byName[o.name];
    
        o.type = o.type || 'dynamic';

        if( o.type === 'dynamic') this.bodys = this.bodys.filter( body => body !== mesh );
        else if ( o.type === 'static') this.solids = this.solids.filter( solid => solid !== mesh );

    }




    //--------------------------------------
    //
    //   TERRAIN
    //
    //--------------------------------------

    terrain ( o ) {

        o.name = o.name === undefined ? 'terrain' : o.name;

        o.sample = o.sample === undefined ? [64,64] : o.sample;
        o.pos = o.pos === undefined ? [0,0,0] : o.pos;
        o.complexity = o.complexity === undefined ? 30 : o.complexity;


        let terrain = new Terrain( o );

        terrain.physicsUpdate = function () { return this.physicsWorker.terrainPostStep({ name:this.name, heightData:this.heightData })} 


        

        this.scene.add( terrain );
        this.solids.push( terrain );


        o.heightData = terrain.heightData;

        o.offset = 0;

        //this.mat['terrain'] = mesh.material;

        this.byName[ o.name ] = terrain;

        // send to worker
        return this.physicsWorker.add( o );

    }

    completeTerrain ( name ){

        let t = this.byName[ name ];
        if(t) t.updateGeometry(); 
        this.isTmove = false;

    }

    updateTerrain ( name ){

        let t = this.byName[ name ];

        if(t.isWater){ t.local.y += 0.25; t.local.z += 0.25; t.update( true ) }
        else t.easing( true );

    }

    moveTerrainTo ( name, x, z ){

        this.isTmove = true;
        let t = this.byName[ name ];
        t.local.x += x || 0;
        t.local.z += z || 0;
        t.update( true );
        

    }


    testWorker(){

        return this.physicsWorker.testWorker();

    }

    
    logOutput (msg){

        if(!this.debug) return;

        console.log(msg);
    }
}
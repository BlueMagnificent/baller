// Original work Copyright © 2010-2017 three.js authors
// Modified work Copyright 2019 BlueMagnificent

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


/**   _   _____ _   _   
*    | | |_   _| |_| |
*    | |_ _| | |  _  |
*    |___|_|_| |_| |_|
*    @author lo.th / http://lo-th.github.io/labs/
*    AMMO worker ultimate
*
*    By default, Bullet assumes units to be in meters and time in seconds. 
*    Moving objects are assumed to be in the range of 0.05 units, about the size of a pebble, 
*    to 10, the size of a truck. 
*    The simulation steps in fraction of seconds (1/60 sec or 60 hertz), 
*    and gravity in meters per square second (9.8 m/s^2).
*
*
*   ---------------------------------------------------------------------------
*    
*    Slightly modified by "Blue, The Magnificent"
* 
*/



//import comlink script
importScripts('comlink.js');

var Module = { TOTAL_MEMORY: 256*1024*1024 };

var Ammo, start;

var world = null;
var worldInfo = null;
var solver, collision, dispatcher, broadphase, ghostPairCallback;


var trans, pos, quat, gravity;
var tmpTrans, tmpPos, tmpQuat, origineTrans;
var tmpPos1, tmpPos2, tmpPos3, tmpPos4, tmpZero;
var tmpTrans1, tmpTrans2;
var inertia;

// forces
var tmpForce = [];//null;

// kinematic
var tmpMatrix = [];

//var tmpset = null;

// array
var bodys, solids, joints, terrains, contacts, contactGroups;
// object
var byName;

var timeStep = 1/60;
//var timerStep = timeStep * 1000;

var numStep = 2;//4//3;// default is 1. 2 or more make simulation more accurate.
var ddt = 1;
var key = [ 0,0,0,0,0,0,0,0 ];

var debug = false;

var ArLng, ArPos, ArMax;


var fixedTime = 0.01667;
var last_step = Date.now();
var timePassed = 0;

var STATE = {
    ACTIVE : 1,
    ISLAND_SLEEPING : 2,
    WANTS_DEACTIVATION : 3,
    DISABLE_DEACTIVATION : 4,
    DISABLE_SIMULATION : 5
}

var FLAGS = {
    STATIC_OBJECT : 1,
    KINEMATIC_OBJECT : 2,
    NO_CONTACT_RESPONSE : 4,
    CUSTOM_MATERIAL_CALLBACK : 8,
    CHARACTER_OBJECT : 16,
    DISABLE_VISUALIZE_OBJECT : 32,
    DISABLE_SPU_COLLISION_PROCESSING : 64 
};

var GROUP = { 
    DEFAULT : 1, 
    STATIC : 2, 
    KINEMATIC : 4, 
    DEBRIS : 8, 
    SENSORTRIGGER : 16, 
    NOCOLLISION : 32,
    GROUP0 : 64,
    GROUP1 : 128,
    GROUP2 : 256,
    GROUP3 : 512,
    GROUP4 : 1024,
    GROUP5 : 2048,
    GROUP6 : 4096,
    GROUP7 : 8192,
    ALL : -1 
}


//--------------------------------------------------
//
//  WORLD
//
//--------------------------------------------------

async function init ( o ) {

    debug = o.debug || false;

    ArLng = o.settings[0];
    ArPos = o.settings[1];
    ArMax = o.settings[2];
    

    importScripts( o.blob );

    await new Promise(resolve=>{


        Ammo().then( function( Ammo ) { 

            initMath();
    
            // active transform
    
            trans = new Ammo.btTransform();
            quat = new Ammo.btQuaternion();
            pos = new Ammo.btVector3();
    
            // tmp Transform
    
            origineTrans = new Ammo.btTransform();
    
            tmpTrans = new Ammo.btTransform();
            tmpPos = new Ammo.btVector3();
            tmpQuat = new Ammo.btQuaternion();
    
            //inertia
            inertia = new Ammo.btVector3( 0, 0, 0 );
    
            // extra vector
    
            tmpPos1 = new Ammo.btVector3();
            tmpPos2 = new Ammo.btVector3();
            tmpPos3 = new Ammo.btVector3();
            tmpPos4 = new Ammo.btVector3();
    
            tmpZero = new Ammo.btVector3( 0,0,0 );
    
            // extra transform
    
            tmpTrans1 = new Ammo.btTransform();
            tmpTrans2 = new Ammo.btTransform();
    
            // gravity
            gravity = new Ammo.btVector3();
    
            addWorld(o);
    
            bodys = []; // 0
            joints = []; // 1
            terrains = [];
            solids = [];
    
            contacts = [];
            contactGroups = [];
    
            // use for get object by name
            byName = {};

            resolve();
    
        });



    })


    return true;
    
};

function step( o ){
    
    // ------- pre step

    key = o.key;

    // update matrix

    updateMatrix();

    // update forces

    updateForce();

    // terrain update

    terrainUpdate();

    return runStepSimulation(o.timeStep || timeStep, numStep );

}

function runStepSimulation(timeStep, numStep){
    
    // ------- step
    world.stepSimulation(timeStep, numStep );

    let Ar = [];

    stepRigidBody( Ar, ArPos[0] );

    stepConstraint( Ar, ArPos[1] );
    stepContact();

    return { status: true,  Ar:Ar, contacts:contacts };
}


function setWorldParameter( o ){

    o = o || {};

    timeStep = o.timeStep !== undefined ? o.timeStep : 0.016;
    numStep = o.numStep !== undefined ? o.numStep : 2;

    // gravity
    setGravity( {g: o.gravity} );


    // penetration
    var dInfo = world.getDispatchInfo();
    if( o.penetration !== undefined ) dInfo.set_m_allowedCcdPenetration( o.penetration );// default 0.0399

    return true;

}

function reset ( o ) {


    tmpForce = [];
    tmpMatrix = [];

    clearContact();
    clearJoint();
    clearRigidBody();
    clearTerrain();

    // clear body name object
    byName = {};

    if( o.full ){

        clearWorld();
        addWorld( o );

    }

    setGravity();

    return true;

};



function wipe (obj) {
    for (var p in obj) {
        if ( obj.hasOwnProperty( p ) ) delete obj[p];
    }
};

//--------------------------------------------------
//
//  ADD
//
//--------------------------------------------------

function add ( o, extra ) {

    o.type = o.type === undefined ? 'box' : o.type;

    var type = o.type;
    var prev = o.type.substring( 0, 4 );
    

    if( prev === 'join' ) addJoint( o );
    else if( type === 'terrain' ) addTerrain( o );
    else addRigidBody( o, extra );

};



function remove( o ){

    if( o.name === undefined || o.name === null || o.name === '') return;

    let b = getByName( o.name );

    if( b === null) return;

    delete byName[o.name];

    bodys = bodys.filter( body => body !== b );

    world.removeRigidBody( b );
    Ammo.destroy( b );

    b = null;

}


function removeArray( o ){

    if( !Array.isArray( o ) ) return;

    o.forEach( obj => remove( obj ));

}

//--------------------------------------------------
//
//  RAY
//
//--------------------------------------------------

function addRay ( o ) {

    if( o.p1 !== undefined ) tmpPos1.fromArray( o.p1 );
    if( o.p2 !== undefined ) tmpPos2.fromArray( o.p2 );

    var rayCallback = new Ammo.ClosestRayResultCallback( tmpPos1, tmpPos2 );
    world.rayTest( tmpPos1, tmpPos2, rayCallback );

    //if(rayCallback.hasHit()){
       // printf("Collision at: <%.2f, %.2f, %.2f>\n", rayCallback.m_hitPointWorld.getX(), rayCallback.m_hitPointWorld.getY(), rayCallback.m_hitPointWorld.getZ());
   // }

};

//--------------------------------------------------
//
//  GET OBJECT
//
//--------------------------------------------------

function getByName( n ){

    return byName[ n ] || null;

}

function getByIdx( n ){

    var u = n.toFixed(1);
    var id = parseInt( u );
    var range = Number( u.substring( u.lastIndexOf('.') + 1 ));

    switch( range ){

        case 1 : return bodys[id]; break;
        case 2 : return solids[id]; break;
        case 3 : return terrains[id]; break;
        case 4 : return joints[id]; break;

    }

}


//---------------------
// FORCES
//---------------------

function updateForce () {

    while( tmpForce.length > 0 ) applyForce( tmpForce.pop() );

}

function applyForce ( r ) {

    var b = getByName( r[0] );

    if( b === null ) return;

    var type = r[1] || 'force';

    if( r[2] !== undefined ) tmpPos1.fromArray( r[2] );
    if( r[3] !== undefined ) tmpPos2.fromArray( r[3] );
    else tmpPos2.zero();

    switch( type ){
        case 'force' : case 0 : b.applyForce( tmpPos1, tmpPos2 ); break;// force , rel_pos 
        case 'torque' : case 1 : b.applyTorque( tmpPos1 ); break;
        case 'localTorque' : case 2 : b.applyLocalTorque( tmpPos1 ); break;
        case 'forceCentral' :case 3 :  b.applyCentralForce( tmpPos1 ); break;
        case 'forceLocal' : case 4 : b.applyCentralLocalForce( tmpPos1 ); break;
        case 'impulse' : case 5 : b.applyImpulse( tmpPos1, tmpPos2 ); break;// impulse , rel_pos 
        case 'impulseCentral' : case 6 : b.applyCentralImpulse( tmpPos1 ); break;

        // joint

        case 'motor' : case 7 : b.enableAngularMotor( true, r[2][0], r[2][1] ); break; // bool, targetVelocity, maxMotorImpulse

    }
    

}

//---------------------
// MATRIX
//---------------------

function updateMatrix () {

    while( tmpMatrix.length > 0 ) applyMatrix( tmpMatrix.pop() );

}

function applyMatrix ( r ) {

    var isOr = false;

    var b = getByName( r[0] );

    if( b === undefined ) return;
    if( b === null ) return;

    var isK = b.isKinematic || false;

    if(r[3]){ // keep original position

        b.getMotionState().getWorldTransform( origineTrans );
        var or = [];
        origineTrans.toArray( or );
        var i = r[3].length, a;

        isOr = true;

        while(i--){

            a = r[3][i];
            if( a === 'x' ) r[1][0] = or[0]-r[1][0];
            if( a === 'y' ) r[1][1] = or[1]-r[1][1];
            if( a === 'z' ) r[1][2] = or[2]-r[1][2];
            if( a === 'rot' ) r[2] = [ or[3], or[4], or[5], or[6] ];

        }
    }

    

    tmpTrans.setIdentity();

    if( r[1] !== undefined ) { tmpPos.fromArray( r[1] ); tmpTrans.setOrigin( tmpPos ); }
    if( r[2] !== undefined ) { tmpQuat.fromArray( r[2] ); tmpTrans.setRotation( tmpQuat ); }
    //else { tmpQuat.fromArray( [2] ); tmpTrans.setRotation( tmpQuat ); }

    if(!isK && !isOr){

       // console.log('ss')

       // zero force
       b.setAngularVelocity( tmpZero );
       b.setLinearVelocity( tmpZero );

    }
    
    if(!isK ){
        b.setWorldTransform( tmpTrans );
        b.activate();
     } else{
        b.getMotionState().setWorldTransform( tmpTrans );
     }

}

//--------------------------------------------------
//
//  WORLD
//
//--------------------------------------------------

function clearWorld () {

    //world.getBroadphase().resetPool( world.getDispatcher() );
    //world.getConstraintSolver().reset();

    Ammo.destroy( world );
    Ammo.destroy( solver );
    Ammo.destroy( collision );
    Ammo.destroy( dispatcher );
    Ammo.destroy( broadphase );

    world = null;

};

function addWorld ( o ) {

    o = o || {};

    if( world !== null ) return;


    solver = new Ammo.btSequentialImpulseConstraintSolver();
    collision =  new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher( collision );

    switch( o.broadphase === undefined ? 2 : o.broadphase ){

        //case 0: broadphase = new Ammo.btSimpleBroadphase(); break;
        case 1: var s = 1000; broadphase = new Ammo.btAxisSweep3( new Ammo.btVector3(-s,-s,-s), new Ammo.btVector3(s,s,s), 4096 ); break;//16384;
        case 2: broadphase = new Ammo.btDbvtBroadphase(); break;
        
    }

    world =  new Ammo.btDiscreteDynamicsWorld( dispatcher, broadphase, solver, collision );

    //console.log(world.getSolverInfo())
    

    /*
    ghostPairCallback = new Ammo.btGhostPairCallback();
    world.getPairCache().setInternalGhostPairCallback( ghostPairCallback );
    */
    
    var dInfo = world.getDispatchInfo();

    if( o.penetration !== undefined ) dInfo.set_m_allowedCcdPenetration( o.penetration );// default 0.0399


    //console.log(world)



    //console.log(dInfo.get_m_convexConservativeDistanceThreshold())

    /*

    dInfo.set_m_convexConservativeDistanceThreshold() // 0
    dInfo.set_m_dispatchFunc() // 1
    dInfo.set_m_enableSPU() // true
    dInfo.set_m_enableSatConvex() // false
    dInfo.set_m_stepCount() // 0
    dInfo.set_m_timeOfImpact() // 1
    dInfo.set_m_timeStep() // 0
    dInfo.set_m_useContinuous() // true
    dInfo.set_m_useConvexConservativeDistanceUtil() // false
    dInfo.set_m_useEpa() // true

    */


    setGravity( o );
    
};

function setGravity ( o ) {

    o = o || {};

    if( world === null ) return;

    gravity.fromArray( o.g || [0,-10, 0] );
    world.setGravity( gravity );

};





//--------------------------------------------------
//
//  AMMO MATH
//
//--------------------------------------------------

var torad = 0.0174532925199432957;
var todeg = 57.295779513082320876;

//--------------------------------------------------
//
//  btTransform extend
//
//--------------------------------------------------

function initMath(){



    Ammo.btTransform.prototype.toArray = function( array, offset ){

        //if ( offset === undefined ) offset = 0;
        offset = offset || 0;

        this.getOrigin().toArray( array , offset );
        this.getRotation().toArray( array , offset + 3 );

        //return array;

    };

    //--------------------------------------------------
    //
    //  btVector3 extend
    //
    //--------------------------------------------------

    Ammo.btVector3.prototype.zero = function( v ){

        this.setValue( 0, 0, 0 );
        return this;

    };

    Ammo.btVector3.prototype.negate = function( v ){

        this.setValue( -this.x(), -this.y(), -this.z() );
        return this;

    };

    Ammo.btVector3.prototype.add = function( v ){

        this.setValue( this.x() + v.x(), this.y() + v.y(), this.z() + v.z() );
        return this;

    };

    Ammo.btVector3.prototype.fromArray = function( array, offset ){

        //if ( offset === undefined ) offset = 0;
        offset = offset || 0;

        this.setValue( array[ offset ], array[ offset + 1 ], array[ offset + 2 ] );

        return this;

    };

    Ammo.btVector3.prototype.toArray = function( array, offset ){

        //if ( array === undefined ) array = [];
        //if ( offset === undefined ) offset = 0;
        offset = offset || 0;

        array[ offset ] = this.x();
        array[ offset + 1 ] = this.y();
        array[ offset + 2 ] = this.z();

        //return array;

    };

    Ammo.btVector3.prototype.direction = function( q ){

        // quaternion 
        
        var qx = q.x();
        var qy = q.y();
        var qz = q.z();
        var qw = q.w();

        var x = this.x();
        var y = this.y();
        var z = this.z();

        // calculate quat * vector

        var ix =  qw * x + qy * z - qz * y;
        var iy =  qw * y + qz * x - qx * z;
        var iz =  qw * z + qx * y - qy * x;
        var iw = - qx * x - qy * y - qz * z;

        // calculate result * inverse quat

        var xx = ix * qw + iw * - qx + iy * - qz - iz * - qy;
        var yy = iy * qw + iw * - qy + iz * - qx - ix * - qz;
        var zz = iz * qw + iw * - qz + ix * - qy - iy * - qx;

        this.setValue( xx, yy, zz );

    };

    //--------------------------------------------------
    //
    //  btQuaternion extend
    //
    //--------------------------------------------------

    Ammo.btQuaternion.prototype.fromArray = function( array, offset ){

        //if ( offset === undefined ) offset = 0;
        offset = offset || 0;
        this.setValue( array[ offset ], array[ offset + 1 ], array[ offset + 2 ], array[ offset + 3 ] );

    };

    Ammo.btQuaternion.prototype.toArray = function( array, offset ){

        //if ( array === undefined ) array = [];
        //if ( offset === undefined ) offset = 0;
        offset = offset || 0;

        array[ offset ] = this.x();
        array[ offset + 1 ] = this.y();
        array[ offset + 2 ] = this.z();
        array[ offset + 3 ] = this.w();

        //return array;

    };

    Ammo.btQuaternion.prototype.setFromAxisAngle = function( axis, angle ){

        var halfAngle = angle * 0.5, s = Math.sin( halfAngle );
        this.setValue( axis[0] * s, axis[1] * s, axis[2] * s, Math.cos( halfAngle ) );

    };

    /*Ammo.btTypedConstraint.prototype.getA = function( v ){

        return 1

    };*/


}


function force ( o ){

    tmpForce.push( o );

}


function forceArray (o ){

    tmpForce = o

}

function matrix ( o ){

    tmpMatrix.push( o );

}


function matrixArray ( o ){

    tmpMatrix = o;

}

function stepConstraint ( AR, N ) {

    //if( !joints.length ) return;

    joints.forEach( function ( b, id ) {

        var n = N + (id * 4);

        if( b.type ){

            AR[ n ] = b.type;

        }
                

    });

};

function clearJoint () {

    var j;

    while( joints.length > 0 ){

        j = joints.pop();
        world.removeConstraint( j );
        Ammo.destroy( j );

    }

    joints = [];

};


function addJoint ( o ) {

    var noAllowCollision = true;
    var collision = o.collision || false;
    if( collision ) noAllowCollision = false;

    if(o.body1) o.b1 = o.body1;
    if(o.body2) o.b2 = o.body2;

    var b1 = getByName( o.b1 );
    var b2 = getByName( o.b2 );

    tmpPos1.fromArray( o.pos1 || [0,0,0] );
    tmpPos2.fromArray( o.pos2 || [0,0,0] );
    tmpPos3.fromArray( o.axe1 || [1,0,0] );
    tmpPos4.fromArray( o.axe2 || [1,0,0] );

    
    if(o.type !== "joint_p2p" && o.type !== "joint_hinge" && o.type !== "joint" ){

        // frame A

        tmpTrans1.setIdentity();
        tmpTrans1.setOrigin( tmpPos1 );
        if( o.quatA ){
            tmpQuat.fromArray( o.quatA ); 
            tmpTrans1.setRotation( tmpQuat );
        }
        
        // frame B

        tmpTrans2.setIdentity();
        tmpTrans2.setOrigin( tmpPos2 );
        if( o.quatB ){ 
            tmpQuat.fromArray( o.quatB );
            tmpTrans2.setRotation( tmpQuat );
        }

    }

    // use fixed frame A for linear llimits useLinearReferenceFrameA
    var useA =  o.useA !== undefined ? o.useA : true;

    var joint = null;
    var t = 0;

    switch(o.type){
        case "joint_p2p":
            t = 1;
            joint = new Ammo.btPoint2PointConstraint( b1, b2, tmpPos1, tmpPos2 );
            if(o.strength) joint.get_m_setting().set_m_tau( o.strength );
            if(o.damping) joint.get_m_setting().set_m_damping( o.damping ); 
            if(o.impulse) joint.get_m_setting().set_m_impulseClamp( o.impulse );
        break;
        case "joint_hinge": case "joint": t = 2; joint = new Ammo.btHingeConstraint( b1, b2, tmpPos1, tmpPos2, tmpPos3, tmpPos4, useA ); break;
        case "joint_slider": t = 3; joint = new Ammo.btSliderConstraint( b1, b2, tmpTrans1, tmpTrans2, useA ); break;
        case "joint_conetwist": t = 4; joint = new Ammo.btConeTwistConstraint( b1, b2, tmpTrans1, tmpTrans2 ); break;
        case "joint_dof": t = 5; joint = new Ammo.btGeneric6DofConstraint( b1, b2, tmpTrans1, tmpTrans2, useA );  break;
        case "joint_spring_dof": t = 6; joint = new Ammo.btGeneric6DofSpringConstraint( b1, b2, tmpTrans1, tmpTrans2, useA ); break;
        //case "joint_gear": joint = new Ammo.btGearConstraint( b1, b2, point1, point2, o.ratio || 1); break;
    }

    // EXTRA SETTING

    if(o.breaking) joint.setBreakingImpulseThreshold( o.breaking );

    // hinge

    // limite min, limite max, softness, bias, relaxation
    if(o.limit){ 
        if(o.type === 'joint_hinge' || o.type === 'joint' ) joint.setLimit( o.limit[0]*torad, o.limit[1]*torad, o.limit[2] || 0.9, o.limit[3] || 0.3, o.limit[4] || 1.0 );
        else if(o.type === 'joint_conetwist' ) joint.setLimit( o.limit[0]*torad, o.limit[1]*torad, o.limit[2]*torad, o.limit[3] || 0.9, o.limit[4] || 0.3, o.limit[5] || 1.0 );
    }
    if(o.motor) joint.enableAngularMotor( o.motor[0], o.motor[1], o.motor[2] );


    // slider & dof

    if(o.linLower){ tmpPos.fromArray(o.linLower); joint.setLinearLowerLimit( tmpPos ); }
    if(o.linUpper){ tmpPos.fromArray(o.linUpper); joint.setLinearUpperLimit( tmpPos ); }
    
    if(o.angLower){ tmpPos.fromArray(o.angLower); joint.setAngularLowerLimit( tmpPos ); }
    if(o.angUpper){ tmpPos.fromArray(o.angUpper); joint.setAngularUpperLimit( tmpPos ); }

    // spring dof

    if(o.feedback) joint.enableFeedback( o.feedback );
    if(o.enableSpring) joint.enableSpring( o.enableSpring[0], o.enableSpring[1] );
    if(o.damping) joint.setDamping( o.damping[0], o.damping[1] );
    if(o.stiffness) joint.setStiffness( o.stiffness[0], o.stiffness[1] );

    if(o.angularOnly) joint.setAngularOnly( o.angularOnly );
    if(o.enableMotor) joint.enableMotor( o.enableMotor );
    if(o.maxMotorImpulse) joint.setMaxMotorImpulse( o.maxMotorImpulse );
    if(o.motorTarget) joint.setMotorTarget( tmpQuat.fromArray( o.motorTarget ) );


    // debug test 
    joint.type = 0;
    if( o.debug ){
        joint.type = t
        joint.bodyA = b1;
        joint.bodyB = b2;
    }
    
    world.addConstraint( joint, noAllowCollision );

    if( o.name ) byName[o.name] = joint;

    joints.push( joint );

    //console.log( joint );

    o = null;

};




/**   _   _____ _   _   
*    | | |_   _| |_| |
*    | |_ _| | |  _  |
*    |___|_|_| |_| |_|
*    @author lo.th / https://github.com/lo-th
*    AMMO CONTACT
*/

function addContact ( o ) {

    var id = contactGroups.length;
    
    var c = new Contact( o, id );
    if( c.valide ){
        contactGroups.push( c );
        contacts.push(0);
    }

};

function clearContact ( o ) {

    let ct = getContactByName( o );

    if( ct ) {

       contactGroups = contactGroups.filter( val => val !== ct );
       contacts.pop();

       ct.clear();
       ct = null;

       refreshContactIds();

       return true

    }

    return false;

};


function clearAllContact () {

    while( contactGroups.length > 0) contactGroups.pop().clear();
    contactGroups = [];
    contacts = [];

    return true;

};


function disableContact ( o ){

    let ct = getContactByName( o );
    if( ct ) ct.disable();

}


function disableAllContact ( ){

    contactGroups.forEach((ct)=>{

        ct.disable();

    })

}



function enableContact ( o ){
    
    let ct = getContactByName( o );
    if( ct ) ct.enable();

}


function enableAllContact ( ){

    contactGroups.forEach((ct)=>{

        ct.enable();

    })

}


function stepContact () {

    var i = contactGroups.length;
    while( i-- ) contactGroups[i].step();

};


function getContactByName( o ){

    if( o.name === undefined || this.name === null) return null;

    let ct = null;

    contactGroups.forEach((val)=>{

        if( val.name === o.name ) ct = val;

    })

    return ct;

}

function refreshContactIds(){

    contactGroups.forEach((ct, id)=>{

        ct.id = id;

    })

}



//--------------------------------------------------
//
//  CONTACT CLASS
//
//--------------------------------------------------

function Contact ( o, id ) {

    this.a = getByName( o.b1 );
    this.b = o.b2 !== undefined ? getByName( o.b2 ) : null;
    this.name = o.name;
    this.enabled = true;

    if( this.a !== null ){

        this.id = id;
        this.f = new Ammo.ConcreteContactResultCallback();
        this.f.addSingleResult = function(){ contacts[id] = 1; }
        this.valide = true;

    } else {

        this.valide = false;

    }

}

Contact.prototype = {

    step: function () {

        if(!this.enabled) return;

        contacts[ this.id ] = 0;
        if( this.b !== null ) world.contactPairTest( this.a, this.b, this.f );
        else world.contactTest( this.a, this.f );

    },

    clear: function () {

        this.a = null;
        this.b = null;
        Ammo.destroy( this.f );

    },

    enable: function () { this.enable = true; },

    disable: function () { this.enable = false; }

}

//--------------------------------------------------
//
//  AMMO RIGIDBODY
//
//--------------------------------------------------

function stepRigidBody( AR, N ) {

    //if( !bodys.length ) return;

    

    bodys.forEach( function ( b, id ) {

        var n = N + (id * 8);
        AR[n] = b.getLinearVelocity().length() * 9.8;//b.isActive() ? 1 : 0;

        //console.log(b.getLinearVelocity().length() * 9.8);

        if ( AR[n] > 0 ) {

            b.getMotionState().getWorldTransform( trans );
            
            trans.toArray( AR, n + 1 );

            //trans.getOrigin().toArray( Br , n + 1 );
            //trans.getRotation().toArray( Br ,n + 4 );

        }

    });

};

function clearRigidBody () {

    var b;
    
    while( bodys.length > 0 ){

        b = bodys.pop();
        world.removeRigidBody( b );
        Ammo.destroy( b );

    }

    while( solids.length > 0 ){

        b = solids.pop();
        //world.removeRigidBody( b );
        world.removeCollisionObject( b );
        Ammo.destroy( b );

    }

    bodys = [];
    solids = [];

};

function addRigidBody ( o, extra ) {


    var isKinematic = false;
    
    if( o.density !== undefined ) o.mass = o.density;
    if( o.bounce !== undefined ) o.restitution = o.bounce;

    if( o.kinematic ){ 

        o.flag = 2;
        o.state = 4;
        //o.mass = 0;
        isKinematic = true;

    }

    o.mass = o.mass === undefined ? 0 : o.mass;
    o.size = o.size === undefined ? [1,1,1] : o.size;
    o.pos = o.pos === undefined ? [0,0,0] : o.pos;
    o.quat = o.quat === undefined ? [0,0,0,1] : o.quat;

    var shape = null;
    switch( o.type ){

        case 'plane': 
            tmpPos4.fromArray( o.dir || [0,1,0] ); 
            shape = new Ammo.btStaticPlaneShape( tmpPos4, 0 );
        break;

        case 'box': 
            tmpPos4.setValue( o.size[0]*0.5, o.size[1]*0.5, o.size[2]*0.5 );  
            shape = new Ammo.btBoxShape( tmpPos4 );
        break;

        case 'sphere': 
            shape = new Ammo.btSphereShape( o.size[0] ); 
        break;  

        case 'cylinder': 
            tmpPos4.setValue( o.size[0], o.size[1]*0.5, o.size[2]*0.5 );
            shape = new Ammo.btCylinderShape( tmpPos4 );
        break;

        case 'cone': 
            shape = new Ammo.btConeShape( o.size[0], o.size[1]*0.5 );
        break;

        case 'capsule': 
            shape = new Ammo.btCapsuleShape( o.size[0], o.size[1]*0.5 ); 
        break;
        
        case 'compound': 
            //shape = new Ammo.btCompoundShape(); 
            shape = getCompundShape(o.shapes)
        break;

        case 'mesh':
            var mTriMesh = new Ammo.btTriangleMesh();
            var removeDuplicateVertices = true;
            var vx = o.v;
            for (var i = 0, fMax = vx.length; i < fMax; i+=9){
                tmpPos1.setValue( vx[i+0]*o.size[0], vx[i+1]*o.size[1], vx[i+2]*o.size[2] );
                tmpPos2.setValue( vx[i+3]*o.size[0], vx[i+4]*o.size[1], vx[i+5]*o.size[2] );
                tmpPos3.setValue( vx[i+6]*o.size[0], vx[i+7]*o.size[1], vx[i+8]*o.size[2] );
                mTriMesh.addTriangle( tmpPos1, tmpPos2, tmpPos3, removeDuplicateVertices );
            }
            if(o.mass == 0){ 
                // btScaledBvhTriangleMeshShape -- if scaled instances
                shape = new Ammo.btBvhTriangleMeshShape( mTriMesh, true, true );
            }else{ 
                // btGimpactTriangleMeshShape -- complex?
                // btConvexHullShape -- possibly better?
                shape = new Ammo.btConvexTriangleMeshShape( mTriMesh, true );
            }
        break;

        case 'convex':
            shape = new Ammo.btConvexHullShape();
            var vx = o.v;
            for (var i = 0, fMax = vx.length; i < fMax; i+=3){
                vx[i]*=o.size[0];
                vx[i+1]*=o.size[1];
                vx[i+2]*=o.size[2];

                tmpPos1.fromArray( vx , i );
                shape.addPoint( tmpPos1 );
            };
        break;
    }

    if( o.margin !== undefined && shape.setMargin !== undefined ) shape.setMargin( o.margin );

    if( extra == 'isShape' ) return shape;
    
    if( extra == 'isGhost' ){ 
        var ghost = new Ammo.btGhostObject();
        ghost.setCollisionShape( shape );
        ghost.setCollisionFlags( o.flag || 1 ); 
        //o.f = new Ammo.btGhostPairCallback();
        //world.getPairCache().setInternalGhostPairCallback( o.f );
        return ghost;
    }

    tmpPos.fromArray( o.pos );
    tmpQuat.fromArray( o.quat );

    tmpTrans.setIdentity();
    tmpTrans.setOrigin( tmpPos );
    tmpTrans.setRotation( tmpQuat );

    tmpPos1.setValue( 0,0,0 );
    shape.calculateLocalInertia( o.mass, tmpPos1 );
    var motionState = new Ammo.btDefaultMotionState( tmpTrans );

    var rbInfo = new Ammo.btRigidBodyConstructionInfo( o.mass, motionState, shape, tmpPos1 );

    //console.log(rbInfo.get_m_friction(), rbInfo.get_m_restitution(), rbInfo.get_m_rollingFriction());

    if( o.friction !== undefined ) rbInfo.set_m_friction( o.friction );
    if( o.restitution !== undefined ) rbInfo.set_m_restitution( o.restitution );
    //Damping is the proportion of velocity lost per second.
    if( o.linear !== undefined ) rbInfo.set_m_linearDamping( o.linear );
    if( o.angular !== undefined ) rbInfo.set_m_angularDamping( o.angular );
    // prevents rounded shapes, such as spheres, cylinders and capsules from rolling forever.
    if( o.rolling !== undefined ) rbInfo.set_m_rollingFriction( o.rolling );

    
    var body = new Ammo.btRigidBody( rbInfo );
    body.isKinematic = isKinematic;

    //if( o.friction !== undefined ) body.setFriction( o.friction );
    //if( o.restitution !== undefined ) body.setRestitution( o.restitution );
    // prevents rounded shapes, such as spheres, cylinders and capsules from rolling forever.
    //if( o.rolling !== undefined ){ 
    //    body.setRollingFriction( o.rolling );
        // missing function
        //body.setAnisotropicFriction( shape.getAnisotropicRollingFrictionDirection(), 2 );
    //}
    //Damping is the proportion of velocity lost per second.
    //if( o.linear !== undefined ) body.setLinearFactor( o.linear );
    //if( o.angular !== undefined ) body.setAngularFactor( o.angular );

    //console.log(body)
    

    if( o.name ) byName[ o.name ] = body;
    else if ( o.mass !== 0 ) byName[ bodys.length ] = body;

    if ( o.mass === 0 && !isKinematic){

        body.setCollisionFlags( o.flag || 1 ); 
        world.addCollisionObject( body, o.group || 1, o.mask || -1 );
        solids.push( body );

    } else {

       // body.isKinematic = isKinematic;
        body.setCollisionFlags( o.flag || 0 );
        world.addRigidBody( body, o.group || 1, o.mask || -1 );


        /*var n = bodys.length;
        tmpPos.toArray( Br, n + 1 );
        tmpQuat.toArray( Br, n + 4 );*/

        //body.activate();
        /*
        AMMO.ACTIVE = 1;
        AMMO.ISLAND_SLEEPING = 2;
        AMMO.WANTS_DEACTIVATION = 3;
        AMMO.DISABLE_DEACTIVATION = 4;
        AMMO.DISABLE_SIMULATION = 5;
        */
        body.setActivationState( o.state || 1 );
        bodys.push( body );

        if(o.linearVelocity !== undefined) body.setLinearVelocity(new Ammo.btVector3( o.linearVelocity[0], o.linearVelocity[1], o.linearVelocity[2] ) );
        
    }
    

    //if ( o.mass === 0  && !isKinematic) solids.push( body );
    //else bodys.push( body );


    //Ammo.destroy( startTransform );
    //Ammo.destroy( localInertia );
    Ammo.destroy( rbInfo );

    o = null;

};


function getCompundShape(shapes){

    let compoundShape = new Ammo.btCompoundShape(); 

    //let masses = [];
    

    shapes.forEach(el=>{

        tmpPos.fromArray( el.pos );
        tmpQuat.fromArray( el.quat );

        tmpTrans.setIdentity();
        tmpTrans.setOrigin( tmpPos );
        tmpTrans.setRotation( tmpQuat );

        let shape = addRigidBody(el, 'isShape');
        compoundShape.addChildShape( tmpTrans, shape );

        //masses.push( btScalar(el.mass || 1) );
    })

    return compoundShape;

}


/**   _   _____ _   _   
*    | | |_   _| |_| |
*    | |_ _| | |  _  |
*    |___|_|_| |_| |_|
*    @author lo.th / https://github.com/lo-th
*    AMMO TERRAIN
*/


function terrainPostStep ( o ){

    var name = o.name;
    if( byName[ name ] ) byName[ name ].setData( o.heightData );

}

function terrainUpdate ( o ){

    var i = terrains.length;
    while(i--) terrains[ i ].update();

}

function addTerrain ( o ) {

    var terrain = new Terrain( o );
    byName[ terrain.name ] = terrain;
    terrains.push( terrain );

}

function clearTerrain () {

    while( terrains.length > 0) terrains.pop().clear();
    terrains = [];

};

//--------------------------------------------------
//
//  TERRAIN CLASS
//
//--------------------------------------------------

function Terrain ( o ) {

    this.needsUpdate = false;
    this.data = null;
    this.tmpData = null;
    this.dataHeap = null;

    var name = o.name === undefined ? 'terrain' : o.name;
    var size = o.size === undefined ? [1,1,1] : o.size;
    var sample = o.sample === undefined ? [64,64] : o.sample;
    var pos = o.pos === undefined ? [0,0,0] : o.pos;
    var quat = o.quat === undefined ? [0,0,0,1] : o.quat;

    var mass = o.mass === undefined ? 0 : o.mass;
    var margin = o.margin === undefined ? 0.02 : o.margin;
    var friction = o.friction === undefined ? 0.5 : o.friction;
    var restitution = o.restitution === undefined ? 0 : o.restitution;

    var flag = o.flag === undefined ? 1 : o.flag;
    var group = o.group === undefined ? 1 : o.group;
    var mask = o.mask === undefined ? -1 : o.mask;

    // This parameter is not really used, since we are using PHY_FLOAT height data type and hence it is ignored
    var heightScale =  o.heightScale === undefined ? 1 : o.heightScale;

    // Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
    var upAxis =  o.upAxis === undefined ? 1 : o.upAxis;

    // hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
    var hdt = o.hdt || "PHY_FLOAT";

    // Set this to your needs (inverts the triangles)
    var flipEdge =  o.flipEdge !== undefined ? o.flipEdge : false;

    // Creates height data buffer in Ammo heap
    this.setData( o.heightData );
    this.update();

    //var shape = new Ammo.btHeightfieldTerrainShape( sample[0], sample[1], terrainData[name], heightScale, -size[1], size[1], upAxis, hdt, flipEdge );
    var shape = new Ammo.btHeightfieldTerrainShape( sample[0], sample[1], this.data, heightScale, -size[1], size[1], upAxis, hdt, flipEdge );

    //console.log(shape.getMargin())

    tmpPos2.setValue( size[0]/sample[0], 1, size[2]/sample[1] );
    shape.setLocalScaling( tmpPos2 );

    shape.setMargin( margin );

    tmpPos.fromArray( pos );
    tmpQuat.fromArray( quat );

    tmpTrans.setIdentity();
    tmpTrans.setOrigin( tmpPos );
    tmpTrans.setRotation( tmpQuat );

    tmpPos1.setValue( 0,0,0 );
    //shape.calculateLocalInertia( mass, tmpPos1 );
    var motionState = new Ammo.btDefaultMotionState( tmpTrans );

    var rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, tmpPos1 );

    rbInfo.set_m_friction( friction );
    rbInfo.set_m_restitution( restitution );

    var body = new Ammo.btRigidBody( rbInfo );
    body.setCollisionFlags( flag );
    world.addCollisionObject( body, group, mask );

    //solids.push( body );

    this.name = name;
    this.body = body;

    Ammo.destroy( rbInfo );

    o = null;

}

Terrain.prototype = {

    setData: function ( data ) {

        this.tmpData = data;
        this.nDataBytes = this.tmpData.length * this.tmpData.BYTES_PER_ELEMENT;
        this.needsUpdate = true;

    },

    update: function () {

        if( !this.needsUpdate ) return;

        this.malloc();
        //this.data = Malloc_Float( this.tmpData, this.data );
        //console.log(this.data)
        self.postMessage({ m:'terrain', o:{ name:this.name } });
        this.needsUpdate = false;
        this.tmpData = null;

    },

    clear: function (){

        world.removeCollisionObject( this.body );
        Ammo.destroy( this.body );
        Ammo._free( this.dataHeap.byteOffset );
        //Ammo.destroy( this.data );

        this.body = null;
        this.data = null;
        this.tmpData = null;
        this.dataHeap = null;

    },

    malloc: function (){

        //var nDataBytes = this.tmpData.length * this.tmpData.BYTES_PER_ELEMENT;
        if( this.data === null ) this.data = Ammo._malloc( this.nDataBytes );
        this.dataHeap = new Uint8Array( Ammo.HEAPU8.buffer, this.data, this.nDataBytes );
        this.dataHeap.set( new Uint8Array( this.tmpData.buffer ) );

    },

}
/*
function terrain_data ( name ){

    var d = tmpData[name];
    terrainData[name] = Malloc_Float( d, terrainData[name] );

    /*
    var i = d.length, n;
    // Creates height data buffer in Ammo heap
    if( terrainData[name] == null ) terrainData[name] = Ammo._malloc( 4 * i );
    // Copy the javascript height data array to the Ammo one.

    while(i--){
        n = (i * 4);
        Ammo.HEAPF32[ terrainData[name] + n >> 2 ] = d[i];
    }
    */

/*    self.postMessage({ m:'terrain', o:{ name:name } });

};
*/


function Malloc_Float( f, q ) {

    var nDataBytes = f.length * f.BYTES_PER_ELEMENT;
    if( q === undefined ) q = Ammo._malloc( nDataBytes );
    var dataHeap = new Uint8Array( Ammo.HEAPU8.buffer, q, nDataBytes );
    dataHeap.set( new Uint8Array( f.buffer ) );
    return q;

}


function testWorker(){

    console.log('Hello From Worker');

}



function logOutput (msg){

    if(!debug) return;

    console.log(msg);
}


Comlink.expose(self, self);



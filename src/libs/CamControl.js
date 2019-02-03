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

/**
 * Custom Cameral Controller
 */

import * as THREE from 'three'
import * as MISC from './Misc'


export default class CamControl extends THREE.Group{

    constructor(camera){
        super();

        this.pitchController = new THREE.Group();
        this.yawController = new THREE.Group();

        this.pitchController.add(camera);
        this.yawController.add(this.pitchController);
        this.add(this.yawController);
        
        this.camera = camera;
        this.camTurnSpan = 90 * MISC.deg2Rad;

        this.tween = null;
        
        this.resetPerspective();

    }

    resetPerspective(){

        this.inTransition = false;
        this.onTurnCompleted = null;

        this.turnDirection = 'right';
        this.turnObj = {initial: 0, current: 0, direction: 1};
        

        if(this.tween){

            this.tween.stop();

        }
        else{

            this.tween = new TWEEN.Tween(this.turnObj);

        }


        this.camera.position.set(0, 0, 30);

        this.pitchController.rotation.set(0, 0, 0);
        this.pitchController.rotateX( -90 * MISC.deg2Rad );

        this.yawController.rotation.set(0, 0, 0);
        
    }


    /**
     * Rotate the controller by 90 degrees
     * 
     * @param {Boolean} right a boolean indicating right direction or left if otherwise
     * @param {Function} cb Callback to be invoked when the rotation transition is completed
     * @memberof CamControl
     */
    turn(right, cb){

        
        if(right === null || right === undefined || !cb ) return;
        if(typeof right !== "boolean") return;

        this.turnObj.initial = this.yawController.rotation.y;
        this.turnObj.current = 0;
        this.turnObj.direction = right ? 1 : -1;

        

        this.onTurnCompleted = cb;

        this.tween.to( { current: this.camTurnSpan } , 300)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(()=>{
                
                let newRot = this.turnObj.initial + (this.turnObj.current * this.turnObj.direction);
                this.yawController.rotation.y = newRot;
                
            })
            .start()
            .onComplete(()=>{ this.inTransition = false; this.onTurnCompleted();});

        this.inTransition = true;
    }



    /**
     * Rotate the controller Right by 90 degrees
     * 
     * {Function} cb Callback to be invoked when the rotation transition is completed
     * @memberof CamControl
     */
    turnRight(cb){

        if(!cb) return;
        
        this.turn(true, cb);
    }



    /**
     * Rotate the controller Left by 90 degrees
     * 
     * @param {Function} cb Callback to be invoked when the rotation transition is completed
     * @memberof CamControl
     */
    turnLeft(cb){

        if(!cb) return;
        
        this.turn(false, cb);
    }


    translateCamera( units ){

        this.camera.translateZ(units)

    }


    /**
     * Subscribe to the update event of the main application
     * 
     * @memberof CamControl
     */
    handleUpdate(){

        if(!this.inTransition) return;
        
        TWEEN.update();

    }

}
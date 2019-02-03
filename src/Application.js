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



import * as THREE from 'three';
import EventType from './libs/EventType'
import ViewPort from './libs/ViewPort'


export default class Application {
    constructor(opts = {}) {
        this.pitchLeft = false;
        this.pitchRight = false;
        this.eventHandlers = {};
        this.domParent = opts.domParent || document.body;
        this.mixers = [];
        this.viewports = [];
        
        this.clock = new THREE.Clock();

        this.bindMouseEvents();
        this.bindKeyEvents();
        this.bindResizeEvent();
    }


    /**
     * Run the application class
     * 
     * @memberof Application
     */
    run(){
        this.init();
    }


    /**
     * bind window mouse events to call back
     * 
     * @memberof Application
     * 
     */
    bindMouseEvents(){
        window.addEventListener('mousemove', (ev)=>{

            ev.preventDefault();

            if(this.currentX === undefined) this.currentX = 0;
            if(this.currentY === undefined) this.currentY = 0;

            let newX = ev.screenX
            let newY = ev.screenY;

            let DX = newX - this.currentX;
            let DY = newY - this.currentY;

            let movementX = ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0;
            let movementY = ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0;

            this.currentX = newX;
            this.currentY = newY;

            let coordX = ( ev.clientX / window.innerWidth ) * 2 - 1;
            let coordY = - ( ev.clientY / window.innerHeight ) * 2 + 1;

            let eventData = {x: newX, y: newY, DX, DY, ctrlKey: ev.ctrlKey, shiftKey: ev.shiftKey, altKey: ev.altKey, coordX, coordY, movementX, movementY};
            this.sendEvent(EventType.EVT_MOUSE_MOVE, eventData);
        });

        
        window.addEventListener('click', (ev)=>{

            let eventData = {coord: {x: ( ev.clientX / window.innerWidth ) * 2 - 1, y: - ( ev.clientY / window.innerHeight ) * 2 + 1}};
            this.sendEvent(EventType.EVT_MOUSE_CLICK, eventData);

        });

        window.addEventListener('wheel', (ev)=>{

            let eventData = { DX: ev.deltaX, DY: ev.deltaY, DZ: ev.deltaZ };
            this.sendEvent(EventType.EVT_WHEEL, eventData);

        })
    }


    /**
     * bind keyboard key events
     * 
     * @memberof Application
     */
    bindKeyEvents(){

        window.addEventListener('keydown', (ev)=>{
            let eventData = ev;
            this.sendEvent(EventType.EVT_KEY_DOWN, eventData);
        });

        window.addEventListener('keyup', (ev)=>{
            let eventData = ev;
            this.sendEvent(EventType.EVT_KEY_UP, eventData);
        });

    }

    /**
     * bind window resize event to callback
     * 
     * @memberof Application
     */
    bindResizeEvent(){
        window.addEventListener('resize', (ev)=>{
            this.sendEvent(EventType.EVT_WINDOW_RESIZE, {});
        })
    }

    
    /**
     * Add a handler for the respective event type
     * 
     * @param {Symbol} eventType the name of the event
     * @param {Function} handler handler for the event
     * @memberof Application
     */
    subscribeToEvent(eventType, handler){
        if(this.eventHandlers[eventType] === undefined){
            this.eventHandlers[eventType] = [];
        }

        this.eventHandlers[eventType].push(handler);
    }
    

    /**
     * Send/Invoke an event
     * 
     * @param {Symbol} eventType  the name of the event
     * @param {Object} eventData event data to be passed to the even handler
     * @memberof Application
     */
    sendEvent(eventType, eventData){
        if(eventData === undefined){
            eventData = {};
        }

        this.executeEventHandlers(eventType, eventData);
    }

    
    /**
     * Run every event handler for the supplied event
     * 
     * @param {String} eventType the name of the event
     * @param {Object} eventData event data to be passed to the even handler
     * @memberof Application
     */
    executeEventHandlers(eventType, eventData){
        let handlers = this.eventHandlers[eventType];

        if(handlers !== undefined){
            handlers.forEach(handler => {
                handler(eventData);
            });
        }
    }

    /**
     * Create a new viewport object and add it to the array of viewports
     * 
     * @param {Object} scene 
     * @param {Object} camera 
     * @param {Object} renderer 
     * @returns Viewport
     * @memberof Application
     */
    addViewport(scene, camera, renderer){
        let viewport = new ViewPort(scene, camera, renderer);
        this.viewports.push(viewport);
        return viewport;
    }

    /**
     * Run the event loop
     * 
     * @memberof Application
     */
    runRenderLoop() {
        let timeStep = this.clock.getDelta();
        this.sendEvent(EventType.EVT_UPDATE, {timeStep});

        this.viewports.forEach((viewport)=>{
            viewport.renderToViewport();
        });

        this.sendEvent(EventType.EVT_POST_UPDATE, {timeStep});

        requestAnimationFrame( this.runRenderLoop.bind(this) );
    }

}

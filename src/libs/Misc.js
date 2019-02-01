
import * as THREE from 'three'

//create randome color
function createRandomColor() {
    return Math.floor( Math.random() * ( 1 << 24 ) );
}

//create random MeshPhongMaterial material
function createRandomMaterial() {
    return new THREE.MeshPhongMaterial( { color: createRandomColor() } );
}

function intToTimeString (integerTime) {
    let sec_num = parseInt(integerTime, 10); // don't forget the second param
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

class BufferGeometryUtil {
    constructor(){
        this.geos = {};
        this.geos['box'] = new THREE.BufferGeometry().fromGeometry( new THREE.BoxGeometry(1,1,1));
        this.geos['sphere'] = new THREE.BufferGeometry().fromGeometry( new THREE.SphereGeometry(1,16,10));
        this.geos['cylinder'] = new THREE.BufferGeometry().fromGeometry(new THREE.CylinderGeometry(1,1,1));
    }

    getBufferGeometry(type){
        type = this.geos[type] !== undefined ? type : 'box'
        return this.geos[type]
    }
}

const geomUtil = new BufferGeometryUtil();

const deg2Rad = 0.017456;
const rad2Deg = 57.288;


export {
    createRandomColor,
    createRandomMaterial,
    intToTimeString,
    geomUtil,
    deg2Rad,
    rad2Deg
}
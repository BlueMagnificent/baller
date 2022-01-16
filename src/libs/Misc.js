
import * as THREE from 'three'

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

const deg2Rad = 0.017456;
const rad2Deg = 57.288;


export {
    intToTimeString,
    deg2Rad,
    rad2Deg
}
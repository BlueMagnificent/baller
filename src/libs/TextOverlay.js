/**
 * Text Overlay Class
 * 
 * @class TextOverlay
 */
class TextOverlay{
    constructor(){

        this.textOverlayDisplay = document.createElement('div');
        this.injectCSS();
        this.isTyping = false;

    }


    /**
     * Initilize the class to display overlay
     * 
     * @param {String} displayTitle what should be displayed
     * @memberof TextOverlay
     */
    initialize(displayTitle){
        displayTitle = displayTitle || "Loading..."

        this.textOverlayDisplay.innerHTML = `
                    <div id="text-overlay">
                        
                        <div id="cover-overlay" class="grid-display">
                            <div id='display-title'>
                                ${displayTitle}
                            </div>
                            
                            <div id="loader">
                                <div id="overlay-box">
                                    <div class="lds-dual-ring"></div>
                                </div>
                                <div style="text-align: center;">
                                    <div id="progress-display"></div>
                                    <div id="progress-text"></div>
                                </div>

                            </div>
                            <div style="margin: 0px auto; min-width: 500px; width: 70%; font-family: 'Courier New';font-size: 20px;color: white;">

                                <div id="instruction" style="white-space:pre;width: 100%; height: 300px; text-align: left;margin-top: 30px;background: inherit;border: none; font-family: 'Courier New';font-size: 20px;color: white;">
                                </div>

                                <div id='startMsg' style="text-align: center;padding: 3px;background: green; display: none">
                                    <span>Press SpaceBar to start<span>
                                </div>
                            </div>
                            
                            
                            
                        </div>

                        <div id='gameview-overlay' style="display: none">

                            <div id='timer-parent'  style="z-index: 2">
                                <span id='timer-display'></span>
                            </div>

                            <div id="pause-overlay"  style="display: none;  margin: 0px auto; font-family: 'Courier New';font-size: 20px;color: white;">
                                <br/>
                                <br/>
                                <div style="font-family: jokerman;margin: 0px auto;text-align: center;margin-top: 20px;font-size: 50px;color: #cb785e;text-shadow: 2px 2px 5px black;">
                                    <span>PAUSED</span>
                                </div>
                                <br/>
                                <br/>
                                <br/>
                                <br/>
                                <div style="text-align: center;padding: 3px;background: blue; margin: 20px">
                                    <span>Press P to resume<span>
                                </div>
                                <div style="text-align: center;padding: 3px;background: green; margin: 20px">
                                    <span>Press SpaceBar to restart<span>
                                </div>
                            </div>

                        </div>


                        
                        <div id="gameover-overlay"  class="grid-display" style="display: none">
                            <div style="font-family: jokerman;text-align: center;margin-top: 50px;font-size: 50px;color: #cb785e;text-shadow: 2px 2px 5px black;">
                                <div style="color: green">
                                    Well Done
                                </div>
                                <div style="font-size: 26px;padding: 20px; color: red;">
                                    Time: &nbsp;&nbsp;<span id="time-score" style="color: red;"></span>
                                </div>
                            </div>
                            
                            
                            <div style="text-align: center;padding: 3px;background: green; margin: 20px; font-family: 'Courier New'; font-size: 20px; color: white;">
                                <span>Press SpaceBar to restart<span>
                            </div>
                        </div>

                    </div>
        `;

        document.body.appendChild(this.textOverlayDisplay);

        this.showCoverOverlay();
        
    }


    showCoverOverlay(){

        document.getElementById('cover-overlay').style.display = "block";
        document.getElementById('gameview-overlay').style.display = "none";

    }

    showGameViewOverlay(){

        
        document.getElementById('cover-overlay').style.display = "none";
        document.getElementById('gameview-overlay').style.display = "block";


    }



    showTimerDisplay(){

        document.getElementById('timer-parent').style.display = 'block';
        
    }

    hideTimerDisplay(){

        document.getElementById('timer-parent').style.display = 'none';

    }

    showGameInstruction(){

        document.getElementById("loader").style.display = "none";
        let instruction = "`Instruction`";
        instruction += "^1000\nMove the ball to the rotating particles at the end of the board";
        instruction += "^2500\nBe careful not to collide with the red bricks, they will delay you";
        instruction += "^2500\n\n`Controls`"
        instruction += "^1000\nUse mouse movement to tilt board and Key A and D to change viewing angle";


        //somehow its seems like Typed.js npm modules skips the first string in the strings array
        //so an empty string is used to make it behave as expected
        var typed = new Typed("#instruction", {

            startDelay: 1000,
            strings: ["", instruction],
            smartBackspace: true, // Default value
            typeSpeed: 10,
            showCursor: false,
            onStart: ()=>{

                this.isTyping = true;

            },
            onComplete: ()=>{

                setTimeout(()=>{

                    document.getElementById('startMsg').style.display = 'block';
                    this.isTyping = false;

                }, 3000)

            }

          });

        typed.start();

    }

    showPauseDisplay(){

        document.getElementById('pause-overlay').style.display = 'block';

    }


    hidePauseDisplay(){

        document.getElementById('pause-overlay').style.display = 'none';

    }


    showGameOver(){

        
        document.getElementById('cover-overlay').style.display = "none";
        document.getElementById('gameview-overlay').style.display = "none";

        
        document.getElementById('time-score').innerText = document.getElementById('timer-display').innerText;
        document.getElementById('gameover-overlay').style.display = "block";

    }

    hideGameOver(){

        document.getElementById('gameover-overlay').style.display = 'none';

    }






    /**
     * Update to show the progress of the loading process
     * 
     * @param {any} percentage A normalized value (0 - 1) showing the current load progress (required)
     * @param {any} message An optional text to display (optional)
     * @memberof TextOverlay
     */
    updateLoadingDisplay(percentage, message){

        percentage = percentage || 0;
        
        if(Number.isNaN(Number.parseFloat(percentage))) percentage = 0;
        if(percentage > 100) percentage = 100;
        if(percentage < 0) percentage = 0;

        if(typeof message !== 'string') message = 'loading...';

        //document.getElementById('progress-display').innerText = percentage + "%";
        document.getElementById('progress-text').innerText = message;

    }

    updateTimeDisplay(timeText){

        document.getElementById('timer-display').innerText = timeText;

    }
    


    /**
     * Inject the needed css style to the head of the html  document
     * 
     * @memberof TextOverlay
     */
    injectCSS(){

        let css = `
        .lds-dual-ring {
            display: inline-block;
            width: 64px;
            height: 64px;
          }
          .lds-dual-ring:after {
            content: " ";
            display: block;
            width: 46px;
            height: 46px;
            margin: 1px;
            border-radius: 50%;
            border: 5px solid #cef;
            border-color: #cef transparent #cef transparent;
            animation: lds-dual-ring 1.2s linear infinite;
          }
          @keyframes lds-dual-ring {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          
          .grid-display{

            
            background-color: #3c3c3c !important;
            background-color: rgba(149, 138, 124, 0.5);
            background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent);
            background-size: 50px 50px;

          }

          #text-overlay{
              width: 100%;
              height: 100%
          }

          #cover-overlay {
              position: absolute;
              width: 100%;
              height: 100%;
          }

          #display-title{
            width: 500px;
            height: 150px;
            margin: 0px auto;
            font-size: 100px;
            font-family: jokerman;
            color: #cb785e;
            text-shadow: 2px 2px 5px black;
            text-align: center;
            margin-top: 50px;
          }
          

          
          
          #overlay-box{

            width: 100%;
            height: 200px;

            display: -webkit-box;
            display: -moz-box;
            display: box;

            -webkit-box-orient: horizontal;
            -moz-box-orient: horizontal;
            box-orient: horizontal;

            -webkit-box-pack: center;
            -moz-box-pack: center;
            box-pack: center;

            -webkit-box-align: center;
            -moz-box-align: center;
            box-align: center;

            color: #ffffff;
            text-align: center;
          }
          
        #progress-display{
            font-family: jokerman;
            font-size: 30px;
            color: #cedeac;
            text-shadow: 2px 2px 5px black;
        }

        #progress-text{
            font-family: "Comic Sans MS";
            color: black;
        }

        #timer-parent{
            position: absolute;
            width: 100%;
            height: 100%;
            margin: 0px auto;
            text-align: right;
            font-family: jokerman;
            color: #cb785e;
            text-shadow: 2px 2px 2px #8a6161
        }

        #timer-display{
            font-size: 20px
        }

        #pause-overlay {
            position: absolute;
            width: 100%;
            height: 100%;
            background-color: rgba(59, 60, 60, 0.9);
        }
        
        #gameover-overlay {
            position: absolute;
            width: 100%;
            height: 100%;
            background-color: rgba(59, 60, 60, 0.9);
        }
        `,
        head = document.head || document.getElementsByTagName('head')[0],
        style = document.createElement('style');

        style.type = 'text/css';
        if (style.styleSheet){
        // This is required for IE8 and below.
        style.styleSheet.cssText = css;
        } else {
        style.appendChild(document.createTextNode(css));
        }

        head.appendChild(style);
    }
}

const ldOverlay = new TextOverlay();

export default ldOverlay;
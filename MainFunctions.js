const singletons = {canvas:{},webcams:{},shaders:{colorToAlpha}}


function preload(){
  // singletons.shaders. the shader
  singletons.shaders.colorToAlpha = loadShader('shader.vert', 'shader.frag');
}


function setupCanvas(){
  const canvas = createCanvas(windowWidth,windowHeight);
  
  canvas.size(getCanvasResW(),getCanvasResH())
  
  
  greenScreenMedia ={width:640, height:480};
  
  
  
  setSmoothedCanvas(canvas.canvas,true)

  frameRate(30);

  pixelDensity(1);
  singletons.canvas = canvas;
  window.setTimeout(()=>{ windowResized()},0)
  return canvas;

}



function setupWebcams(cb){
  navigator.mediaDevices.enumerateDevices()
  .then(devices=> {
    var num = 0
    const webcams = {}
    devices.forEach(function(device) {
      if(device.kind=="videoinput"){
        console.log(device.kind + ": " + device.label +
          " id = " + device.deviceId);
        console.log(device)
        var name =  "camera:"+num
        if (device.label){
          name = device.label
        }
        else{
          num+=1
        }
        webcams[name] = device
      }
    });
    singletons.webcams = webcams
    if(cb)cb(webcams);

  })
  .catch(function(err) {
    console.log(err.name + ": " + err.message);
  });
}


function initWebcam(device,cb,_caps){
  let caps = _caps ||  {width:{max:maxTargetRes.w},height:{max:maxTargetRes.h}}
  if(device.getCapabilities && !_caps){
    caps = device.getCapabilities() 
    
    if(caps.width && caps.width.max && caps.height && caps.height.max){
      caps.width = Math.min(maxTargetRes.w,caps.width.max)
      caps.height = Math.min(maxTargetRes.h,caps.height.max)
    }
  }

  const constraints = device?{
    audio:false,
    video:{
      deviceId:device.deviceId,
      width:caps.width,
      height:caps.height,
      frameRate:{max:30},
      // resizeMode:"none",
      // width:Math.min(caps.width.max,getCanvasResW()),
      // height:Math.min(caps.height.max,getCanvasResH()),
    }
  }
  : VIDEO

  const wcMedia = createCapture(constraints,st=>{
    if(wcMedia)wcMedia.stream = st;
    if(cb){cb();}
  });

  wcMedia.hide()
  return wcMedia

}



function _smoothRel(x,c){
  if(x<0)return 0;
  if(x>1) return 1;
  return 3*x*x - 2*x*x*x
}
function smoothRel(x,c){
  if(x<0)return 0;
  if(x>1) return 1;
  return x;
}


function colorToAlpha(img,color,threshold,tolerance){
  if(!img  || img.pixels===undefined)return;

  if(  img.pixels.length===0)return;
  if(!tolerance){
    tolerance = 0;
  }
  const curve = 1;
  const w = img.width
  const h = img.height
  const pixT = img.pixels
  color.hsvValue = toHSV(color,0)
  
  const wh = w*h*4
  if(tolerance===0){
    const thresholdSq = threshold*threshold
    for(let i = wh-4 ; i >0; i-=4){
      const dist = normDistSq(pixT,color,i);
      pixT[i+3] = dist>thresholdSq?255:0;
    }
  }
  else{
    const tolerance2 = 2*tolerance;
    const ttol = threshold+tolerance
    for(let i = 0 ; i < wh; i+=4){
      const dist = normDist(pixT,color,i);

      const relDist = (1-(ttol-dist)/tolerance2)
      pixT[i+3] = Math.min(1,Math.max(0,relDist))*255;
      
    }
  }

}

function colorToAlphaShader(img,color,threshold,tolerance){
  if(!img  || img.pixels===undefined)return

    if(  img.pixels.length===0)return
      if(!tolerance){
        tolerance = 0.0001;

      }
      const shaderO = singletons.shaders.colorToAlpha;
      shader(shaderO)
      // lets just send the cam to our shader as a uniform
      shaderO.setUniform('tex1', img);
      

      // also send the mouseX value but convert it to a number between 0 and 1
      shaderO.setUniform('threshold', threshold/255);
      shaderO.setUniform('tolerance', tolerance/255);
      shaderO.setUniform('color', color);

      // rect gives us some geometry on the screen
      rect(0,0,width, height);
    }

    function blurAlpha(img,size){
      if(!img  || img.pixels===undefined)return

        if(  img.pixels.length===0)return


          const w = img.width
        const h = img.height
        const pixT = img.pixels

        for(let  y = 1 ; y < h-1 ; y++){
          for(let x = (y%2)+1; x < w-1 ; x+=2){

            const i =  (y*w+    x)*4+3;
            const it = ((y-1)*w+x)*4+3;
            const ib = ((y+1)*w+x)*4+3;
            const il = ((y)*w+x-1)*4+3;
            const ir = ((y)*w+x+1)*4+3;
            const ta = (pixT[it] + pixT[ib] + pixT[ir] + pixT[il])/4

      // pixT[i-3] = ta
      // pixT[i-2] = 0
      // pixT[i-1] = 0
      // pixT[i] = 255
      pixT[i] = ta

    }
  }

}


function getColorUnderMouseClick(e,greenScreenMedia){
  const canvas = singletons.canvas

    if(e.srcElement != singletons.canvas.canvas )//|| (mouseStart.x>0 && mouseStart.x!=mouseX))
      { return;}
    greenScreenMedia.loadPixels()
    const fitR = fitStretched(greenScreenMedia,canvas)
    const mouseRelX = mouseX - fitR.left
    const mouseRelY = mouseY - fitR.top
    const iCam = Math.floor(mouseRelX*greenScreenMedia.width/fitR.width);
    const jCam = Math.floor(mouseRelY*greenScreenMedia.height/fitR.height);
    console.log(iCam,jCam,fitR)
    const loc = (jCam*greenScreenMedia.width + iCam)*4;
  // greenScreenMedia.loadPixels();
  if(loc+2 < greenScreenMedia.pixels.length){
    const c = [
    greenScreenMedia.pixels[loc + 0],
    greenScreenMedia.pixels[loc + 1],
    greenScreenMedia.pixels[loc + 2],
    ]
    return c;
  }
  else{
    console.error("mouse color : pixel not loaded")
  }
}


let numMedia = 0;
function loadMedia(path,cb,caps){
  med = {};
  if(path.startsWith("webcam:")){
    const webcams = singletons.webcams
    const wNum = parseInt(path.substr(7))
    if(wNum<Object.keys(webcams).length){
      const device= webcams[Object.keys(webcams)[wNum]] 
      med =  initWebcam(device,cb,caps)
      return med
    }
    else{
      console.error('webcam num',wNum,'does not exists' )
    }
  }
  else if (path==="none"){
    return
  }
  else{
    if(!path.startsWith('assets/')){path='assets/'+path}
      if([".mp4",".mov",".avi",".webm"].some(ext=>path.endsWith(ext))){
       med = createVideo(path,
        ()=>{
          med.loop();
          med.volume(0);
          if(cb){cb()}
        })
       med.hide()

     }
     else if([".jpg",".png",".bmp"].some(ext=>path.endsWith(ext))){
      med = loadImage(path
        ,()=>{
          med._pixelsState._pixelsDirty = true;
          med.loadPixels();
          if(cb){cb()}
        }
      )
      med.loadPixels();
      med.numMedia = numMedia++;
    }
    else{
      console.error("extention not supported",path)
    }
    return med
  }
}


function resizeCanvasToWindow(){
  resizeCanvas(getCanvasResW(),getCanvasResH(),true);
  const fit = fitStretched({width:getCanvasResW(),height:getCanvasResH()},
    {width:getWindowWidth(),height:getWindowHeight()}
    )
  canvas.canvas.style.width = ""+fit.width+"px"
  canvas.canvas.style.height = ""+fit.height+"px"
}

function setDownscaling(q){
  CurrentDownscale = q
  resizeCanvasToWindow();
}

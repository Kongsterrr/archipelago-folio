import * as THREE from 'three';
import {CAREER_TRAIN} from '../core/career-train.js';
import {sampleTrainPath} from '../core/train-path.js';

const Y_AXIS=new THREE.Vector3(0,1,0);
const disposeModel=model=>{const geometries=new Set(),materials=new Set();model?.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

/** A replaceable train model and a separate, permanent passenger anchor.
 * Jack must be parented to mountPoint, never to the loaded GLB hierarchy.
 */
export class CareerTrainVisual {
  constructor(scene,controller){
    this.controller=controller;this.group=new THREE.Group();this.group.name='career-train-view';scene.add(this.group);
    this.mountPoint=new THREE.Group();this.mountPoint.name='career-train-passenger';scene.add(this.mountPoint);
    this.model=null;this.cars=[];this.wheels=[];this.crossings=[];this.pose={};this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.delta=new THREE.Vector3();
    this.rail=new THREE.Vector3();this.railPose={};this.carInverse=CAREER_TRAIN.cars.map(()=>new THREE.Matrix4());
    this.coupling=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1,8),new THREE.MeshStandardMaterial({color:'#9b8060',roughness:.36,metalness:.6}));
    this.coupling.name='career-train-moving-coupling';this.group.add(this.coupling);this.coupling.visible=false;
    this.update(1,{frozen:true});
  }
  bind(model){
    const cars=CAREER_TRAIN.cars.map(car=>model.getObjectByName(car.name));
    if(cars.some(car=>!car))throw new Error('Career train model is missing an independent car root.');
    if(this.model){this.group.remove(this.model);disposeModel(this.model);}
    this.model=model;this.group.add(model);this.cars=cars;this.wheels=[];
    model.traverse(o=>{if(/^train-wheel-(engine|coach)-/.test(o.name)&&!o.isMesh)this.wheels.push({object:o,radius:o.name.includes('-engine-')?.42:.36,car:o.name.includes('-engine-')?0:1,base:o.position.clone()});if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.update(1,{frozen:true});return this;
  }
  bindCrossings(model){
    this.releaseCrossings();
    if(!model)return this;
    for(const spec of this.controller.railway.crossings||[]){
      const gates=[],signals=[],seen=new Set();
      for(const gate of spec.gates||[]){
        const object=model.getObjectByName(gate.node);
        if(object)gates.push({object,axis:gate.axis||'z',open:gate.openAngle??Math.PI/2,closed:gate.closedAngle??0,original:object.rotation.clone()});
      }
      for(const signal of spec.signals||[])model.getObjectByName(signal.node)?.traverse(object=>{
        if(!object.isMesh||seen.has(object))return;seen.add(object);
        const original=object.material,materials=(Array.isArray(original)?original:[original]).map(material=>material.clone());
        object.material=Array.isArray(original)?materials:materials[0];
        signals.push({object,original,materials,base:materials.map(material=>({emissive:material.emissive?.clone(),intensity:material.emissiveIntensity}))});
      });
      this.crossings.push({spec,gates,signals,warning:null});
    }
    this.updateCrossings(this.controller.distance);return this;
  }
  releaseCrossings(){
    for(const crossing of this.crossings){
      for(const gate of crossing.gates)gate.object.rotation.copy(gate.original);
      for(const signal of crossing.signals){signal.object.material=signal.original;for(const material of signal.materials)material.dispose();}
    }
    this.crossings=[];
  }
  updateCrossings(distance){
    const length=this.controller.length;
    for(const crossing of this.crossings){
      const ahead=((crossing.spec.distance-distance+length/2)%length+length)%length-length/2;
      const rearClear=CAREER_TRAIN.coachOffset+CAREER_TRAIN.cars[1].halfLength+(crossing.spec.width||2)/2;
      // The gate is down before the leading bumper reaches the crossing and
      // stays down until the complete trailing coach has cleared the lane.
      const closed=ahead>=0?smooth((12-ahead)/6):1-smooth((-ahead-rearClear)/3);
      for(const gate of crossing.gates)gate.object.rotation[gate.axis]=gate.open+(gate.closed-gate.open)*closed;
      const warning=ahead<14&&ahead>-(rearClear+3)?(closed>.999?'red':'amber'):'off';
      if(warning===crossing.warning)continue;crossing.warning=warning;
      for(const signal of crossing.signals)for(let index=0;index<signal.materials.length;index++){
        const material=signal.materials[index],base=signal.base[index];if(!material.emissive)continue;
        if(warning==='off'){material.emissive.copy(base.emissive);material.emissiveIntensity=base.intensity;}
        else{material.emissive.set(warning==='red'?'#ef4d32':'#ffb941');material.emissiveIntensity=1.35;}
      }
    }
  }
  update(alpha=1,{frozen=false}={}){
    const interpolation=frozen?1:alpha;
    for(let index=0;index<this.cars.length;index++){
      const car=this.cars[index],pose=this.controller.carPose(index,interpolation,this.pose);
      car.position.set(pose.x,pose.y,pose.z);car.rotation.set(pose.pitch,pose.yaw,0,'YXZ');
      car.updateWorldMatrix(true,false);this.carInverse[index].copy(car.matrixWorld).invert();
    }
    const distance=this.controller.previousDistance+(this.controller.distance-this.controller.previousDistance)*interpolation;
    for(const wheel of this.wheels){
      wheel.object.rotation.x=-(distance-this.controller.initialDistance)/wheel.radius;
      // A few centimetres of suspension keeps each axle on the eased grade
      // while the carriage itself follows its independent centre tangent.
      let axleDistance=distance-CAREER_TRAIN.cars[wheel.car].offset-wheel.base.z;
      const offset=Math.sign(wheel.base.x)*this.controller.railway.train.gauge/2;
      for(let iteration=0;iteration<3;iteration++){
        const q=sampleTrainPath(this.controller.path,axleDistance,this.railPose),h=Math.hypot(q.tangentX,q.tangentZ);
        this.rail.set(q.x-q.tangentZ/h*offset,q.y,q.z+q.tangentX/h*offset);
        this.controller.worldPoint(this.rail,this.rail);this.rail.applyMatrix4(this.carInverse[wheel.car]);axleDistance+=this.rail.z-wheel.base.z;
      }
      wheel.object.position.y=wheel.base.y+this.rail.y;
    }
    this.updateCrossings(distance);
    const seat=this.controller.seatPose(interpolation,this.pose);this.mountPoint.position.set(seat.x,seat.y,seat.z);this.mountPoint.rotation.set(seat.pitch,seat.yaw,0,'YXZ');this.mountPoint.updateMatrixWorld(true);
    if(this.cars.length===2){
      this.group.updateMatrixWorld(true);this.a.set(0,.65,1.72);this.b.set(0,.65,-1.70);this.cars[0].localToWorld(this.a);this.cars[1].localToWorld(this.b);
      this.coupling.position.copy(this.a).add(this.b).multiplyScalar(.5);this.delta.copy(this.b).sub(this.a);this.coupling.scale.y=this.delta.length();this.coupling.quaternion.setFromUnitVectors(Y_AXIS,this.delta.normalize());this.coupling.visible=true;
    }
  }
  dispose(){
    this.releaseCrossings();
    if(this.model)disposeModel(this.model);this.model=null;this.cars=[];this.wheels=[];
    this.coupling.geometry.dispose();this.coupling.material.dispose();this.group.removeFromParent();
    // The integration owner detaches its avatar before destroying the view.
    this.mountPoint.removeFromParent();
  }
}

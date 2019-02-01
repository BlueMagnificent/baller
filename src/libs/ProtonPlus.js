/**
 * Proton Plus
 * minor addition to Proton Js for emission of particles based on a reference node
 * 
 */

import Proton from 'imports-loader?THREE=THREE!three.proton.js'

//Base render tweak
Proton.BaseRender.prototype.init = function(proton) {
    var self = this;
    this.proton = proton;
    
    this.proton.addEventListener("PROTON_UPDATE", function(proton) {
        self.onProtonUpdate.call(self, proton);
    });

    this.proton.addEventListener("PARTICLE_CREATED", function(particle) {
        self.onParticleCreated.call(self, particle);
    });

    this.proton.addEventListener("PARTICLE_CREATED_PLUS", function(particle) {
        self.onParticleCreatedPlus.call(self, particle);
    });

    this.proton.addEventListener("PARTICLE_UPDATE", function(particle) {
        self.onParticleUpdate.call(self, particle);
    });

    this.proton.addEventListener("PARTICLE_UPDATE_PLUS", function(particle) {
        self.onParticleUpdatePlus.call(self, particle);
    });

    this.proton.addEventListener("PARTICLE_DEAD", function(particle) {
        self.onParticleDead.call(self, particle);
    });
}

Proton.BaseRender.prototype.onParticleCreatedPlus = function(particle) {

}

Proton.BaseRender.prototype.onParticleUpdatePlus = function(particle) {

}


//Mesh Render
Proton.MeshRender.prototype.onParticleCreatedPlus = function(particleWrapper) {
    var particle = particleWrapper.particle;
    var refnode = particleWrapper.refnode;
    var relativeEmission = particleWrapper.relativeEmission;

    particle.relativeEmission = relativeEmission;

    if (!particle.target) {
        //set target
        if (!particle.body) particle.body = this._body;
        particle.target = this._targetPool.get(particle.body);
        
        //set material
        if (particle.useAlpha || particle.useColor) {
            particle.target.material.__puid = Proton.PUID.id(particle.body.material);;
            particle.target.material = this._materialPool.get(particle.target.material);
        }
    }

    if (particle.target) {
        particle.target.position.copy(particle.p);
        
        if(relativeEmission === true) refnode.add(particle.target);
        else{ 

            let v = new THREE.Vector3();
            refnode.getWorldPosition(v);
            particle.refPos = {x: v.x, y: v.y, z: v.z};
            this.container.add(particle.target);
        }
    }
};


Proton.MeshRender.prototype.onParticleUpdatePlus = function(particle) {
    if (particle.target && particle.target.parent) {

        if(particle.relativeEmission){
            particle.target.position.copy(particle.p);
        }
        else{
            let v = particle.refPos || {x: 0, y: 0, z: 0};
            particle.target.position.set(v.x + particle.p.x, v.y + particle.p.y, v.z + particle.p.z);
        }

        particle.target.rotation.set(particle.rotation.x, particle.rotation.y, particle.rotation.z);
        this.scale(particle);

        if (particle.useAlpha) {
            particle.target.material.opacity = particle.alpha;
            particle.target.material.transparent = true;
        }

        if (particle.useColor) {
            particle.target.material.color.copy(particle.color);
        }
    }
};


//Emitter tweak
function AdvEmitter(refnode, pObj){

    if(!refnode) throw new Exception("Invalide reference node");

    this.refnode = refnode;

    this.relativeEmission = true;

    AdvEmitter._super_.call(this, pObj);

}

Proton.Util.inherits(AdvEmitter, Proton.Emitter);
Proton.EventDispatcher.initialize(AdvEmitter.prototype);

AdvEmitter.prototype.update = function(time) {
    this.age += time;
    if (this.dead || this.age >= this.life) {
        this.destroy();
    }

    this.emitting(time);
    this.integrate(time);

    var particle, i = this.particles.length;
    while (i--) {
        particle = this.particles[i];
        if (particle.dead) {
            this.parent && this.parent.dispatchEvent("PARTICLE_DEAD", particle);
            Proton.bindEmtterEvent && this.dispatchEvent("PARTICLE_DEAD", particle);

            this.parent.pool.expire(particle.reset());
            this.particles.splice(i, 1);
        }
    }
};

AdvEmitter.prototype.createParticle = function(initialize, behaviour) {
    var particle = this.parent.pool.get(Proton.Particle);
    this.setupParticle(particle, initialize, behaviour);
    var particleWrapper = {particle: particle, refnode: this.refnode, relativeEmission: this.relativeEmission}

    this.parent && this.parent.dispatchEvent("PARTICLE_CREATED_PLUS", particleWrapper);
    Proton.bindEmtterEvent && this.dispatchEvent("PARTICLE_CREATED_PLUS", particleWrapper);

    return particle;
};


AdvEmitter.prototype.integrate = function(time) {
    var damping = 1 - this.damping;
    Proton.integrator.integrate(this, time, damping);

    var i = this.particles.length;
    while (i--) {
        var particle = this.particles[i];
        particle.update(time, i);
        Proton.integrator.integrate(particle, time, damping);

        this.parent && this.parent.dispatchEvent("PARTICLE_UPDATE_PLUS", particle);
        Proton.bindEmtterEvent && this.dispatchEvent("PARTICLE_UPDATE_PLUS", particle);
    }
};


Proton.AdvEmitter = AdvEmitter;

export default Proton;
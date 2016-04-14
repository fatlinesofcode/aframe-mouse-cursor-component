import { flattenDeep } from 'lodash/core'

if (typeof AFRAME === 'undefined') {
  throw 'Component attempted to register before AFRAME was available.'
}

/**
 * Mouse Cursor Component for A-Frame.
 */
AFRAME.registerComponent('mouse-cursor', {
  schema: { },

  /**
   * Called once when component is attached. Generally for initial setup.
   * @protected
   */
  init () {
    this.__raycaster = new THREE.Raycaster()
    this.__mouse = new THREE.Vector2()
    this.__isMobile = this.el.sceneEl.isMobile
    this.__isStereo = false
    this.__active = false
    this.__attachEventListeners()
  },

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   * @protected
   */
  update (oldData) { },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   * @protected
   */
  remove () {
    this.__removeEventListeners()
    this.__raycaster = null
  },

  /**
   * Called on each scene tick.
   * @protected
   */
  // tick (t) { },

  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   * @protected
   */
  pause () {
    this.__active = false
  },

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   * @protected
   */
  play () {
    this.__active = true
  },

  /*==============================
  =            events            =
  ==============================*/
  
  /**
   * @private
   */
  __attachEventListeners () {

    const { el } = this
    const { sceneEl } = el
    const { canvas } = sceneEl
    /* if canvas doesn't exist, listen for canvas to load. */
    if (!canvas) {
      el.sceneEl.addEventListener('render-target-loaded', this.__attachEventListeners.bind(this))
      return
    }

    /* scene */
    sceneEl.addEventListener('enter-vr', this.__onEnterVR.bind(this))
    sceneEl.addEventListener('exit-vr', this.__onExitVR.bind(this))

    /* Mouse Events */
    canvas.addEventListener('mousedown', this.__onDown.bind(this))
    canvas.addEventListener('mousemove', this.__onMouseMove.bind(this))
    canvas.addEventListener('mouseup', this.__onRelease.bind(this))
    canvas.addEventListener('mouseout', this.__onRelease.bind(this))

    /* Touch events */
    canvas.addEventListener('touchstart', this.__onDown.bind(this))
    canvas.addEventListener('touchmove', this.__onTouchMove.bind(this))
    canvas.addEventListener('touchend', this.__onRelease.bind(this))

  },
  
  /**
   * @private
   */
  __removeEventListeners () {
    const { el } = this
    const { sceneEl } = el
    const { canvas } = sceneEl
    if (!canvas) { return }

    /* scene */
    sceneEl.removeEventListener('enter-vr', this.__onEnterVR.bind(this))
    sceneEl.removeEventListener('exit-vr', this.__onExitVR.bind(this))

    /* Mouse Events */
    canvas.removeEventListener('mousedown', this.__onDown.bind(this))
    canvas.removeEventListener('mousemove', this.__onMouseMove.bind(this))
    canvas.removeEventListener('mouseup', this.__onRelease.bind(this))
    canvas.removeEventListener('mouseout', this.__onRelease.bind(this))

    /* Touch events */
    canvas.removeEventListener('touchstart', this.__onDown.bind(this))
    canvas.removeEventListener('touchmove', this.__onTouchMove.bind(this))
    canvas.removeEventListener('touchend', this.__onRelease.bind(this))

  },
  
  /**
   * Check if the mouse cursor is active
   * @private
   */
  __isActive () {
    return !!(this.__active || !this.__isStereo || this.__raycaster)
  },

  /**
   * @private
   */
  __onDown (evt) {
    if (!this.__isActive()) { return }

    this.isDown = true

    if (this.__isMobile) {
      this.__updateMouse(evt)
      this.__updateIntersectObject()
    }
  },
  
  /**
   * @private
   */
  __onRelease () {
    if (!this.__isActive()) { return }

    if (this.isDown && this.intersectedEl) {
      this.__emit('click')
    }
    this.isDown = false
  },
  
  /**
   * @private
   */
  __onMouseMove (evt) {
    if (!this.__isActive()) { return }

    this.isDown = false
    this.__updateMouse(evt)
    this.__updateIntersectObject()
  },
  
  /**
   * @private
   */
  __onTouchMove (evt) {
    if (!this.__isActive()) { return }

    this.isDown = false
  },
  
  /**
   * @private
   */
  __onEnterVR () {
    this.__isStereo = true
    this.pause()
  },
  
  /**
   * @private
   */
  __onExitVR () {
    this.__isStereo = false
    this.play()
  },
  

  /*=============================
  =            mouse            =
  =============================*/
  
  /**
   * Update mouse position
   * @private
   */
  __updateMouse (evt) {
    const { innerWidth: w, innerHeight: h } = window
    let cx, cy
    if (this.__isMobile) {
      const { touches } = evt
      if (!touches || touches.length !== 1) { return }
      const touch = touches[0]
      cx = touch.pageX
      cy = touch.pageY
    }
    else {
      cx = evt.clientX
      cy = evt.clientY
    }
    this.__mouse.x = (cx / w) * 2 - 1
    this.__mouse.y = - (cy / h) * 2 + 1
  },


  /*======================================
  =            scene children            =
  ======================================*/
  
  /**
   * Get non group object3D
   * @private
   */
  __getChildren (object3D) {
    return object3D.children.map(obj => (obj.type === 'Group')? this.__getChildren(obj) : obj)
  },
  
  /**
   * Get all non group object3D
   * @private
   */
  __getAllChildren () {
    const children = this.__getChildren(this.el.sceneEl.object3D)
    return flattenDeep(children)
  },
  
  /*====================================
  =            intersection            =
  ====================================*/
  
  /**
   * Update intersect element with cursor
   * @private
   */
  __updateIntersectObject () {
    const { __raycaster, el, __mouse } = this
    const { object3D: scene } = el.sceneEl
    const camera = this.el.getObject3D('camera')
    this.__getAllChildren()
    /* find intersections */
    // __raycaster.setFromCamera(__mouse, camera) /* this somehow gets error so did the below */
    __raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld)
    __raycaster.ray.direction.set(__mouse.x, __mouse.y, 0.5).unproject(camera).sub(__raycaster.ray.origin).normalize()

    /* get objects intersected between mouse and camera */
    const children = this.__getAllChildren()
    const intersects = __raycaster.intersectObjects(children)

    if (intersects.length > 0) {
      /* get the closest three obj */
      let obj
      intersects.every(item => {
        if (item.object.parent.visible === true) {
          obj = item.object
          return false
        }
        else {
          return true
        }
      })
      if (!obj) {
        this.__clearIntersectObject()
        return
      }
      /* get the entity */
      const { el } = obj.parent
      /* only updates if the object is not the activated object */
      if (this.intersectedEl === el) { return }
      this.__clearIntersectObject()
      /* apply new object as intersected */
      this.__setIntersectObject(el)
    }
    else {
      this.__clearIntersectObject()
    }
  },
  
  /**
   * Set intersect element
   * @private
   * @param {AEntity} el `a-entity` element
   */
  __setIntersectObject (el) {

    this.intersectedEl = el
    if (this.__isMobile) { return }
    el.addState('hovered')
    el.emit('mouseenter')
    this.el.addState('hovering')

  },
  
  /**
   * Clear intersect element
   * @private
   */
  __clearIntersectObject () {

    const { intersectedEl: el } = this
    if (el && !this.__isMobile) {
      el.removeState('hovered')
      el.emit('mouseleave')
      this.el.removeState('hovering')
    }

    this.intersectedEl = null
  },
  


  /*===============================
  =            emitter            =
  ===============================*/
  
  /**
   * @private
   */
  __emit (evt) {
    const { intersectedEl } = this
    this.el.emit(evt, { target: intersectedEl })
    if (intersectedEl) { intersectedEl.emit(evt) }
  },

})

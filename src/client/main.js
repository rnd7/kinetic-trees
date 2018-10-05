
let dataset = {
  trees:[
    {
      name: "Health",
      seed: Math.random(),
      state: [
        {
          timestamp: Date.now(), // timestamp
        }
      ]
    }
  ]
}


// Template Utilities

  const MONTH_NAMES =  ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]


function makeTemplate(selector) {
  return document.querySelector(selector).innerHTML.replace(/\r?\n|\r/g, '').replace(/\t/g, '')
}


function replaceTemplateTags(template, data) {
  for (var k in data) {
    template = template.replace(new RegExp("{{"+k+"}}", "gi"), data[k])
  }
  return template
}

function renderTemplate(html) {
  var template = document.createElement('template')
  html = html.trim() // Never return a text node of whitespace as the result
  template.innerHTML = html
  return template.content.firstChild
}

function insert(domElement, templateString) {
  domElement.appendChild(renderTemplate(templateString))
}

function removeChildren(domElement) {
  while (domElement.hasChildNodes()) {
    domElement.removeChild(domElement.lastChild)
  }
}

function replace(domElement, templateString) {
  removeChildren(domElement)
  insert(domElement, templateString)
}

// MAth Utilities
const TAU = 2 * Math.PI;
const PHI = (1+Math.sqrt(5))/2
const M89 = Math.pow(89,2)-1
const M31 = Math.pow(31,2)-1

function PRNG(v1) {
  v1 = (v1 + 1) * M89
  let v2 = v1 * M31
  return () => {
    v1 = (v1 * Math.E) % M31
    v2 += (v2 * PHI) % 1
    return (v2 * (v1 * Math.PI)) % 1
  }
}

function mod( a, n ) { return ( a % n + n ) % n; }

function calcAngle(v1, v2) {
  var angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
  if ( angle < 0 ) angle += 2 * Math.PI
  return angle
}

function calcDistance(v1, v2) {
  var tx = v1.x - v2.x
  var ty = v1.y - v2.y
  return Math.sqrt(tx*tx + ty*ty)
  return angle
}

function calcAngleDelta( current, target ) {
  var a = mod( ( current - target ), TAU );
  var b = mod( ( target - current ), TAU );
  return a < b ? -a : b;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
// Display Model


const LEAF_DEFAULTS = {

}
function Leaf(opts) {
  THREE.Object3D.call(this)
  this.opts = Object.assign({}, LEAF_DEFAULTS, opts)
}
Leaf.prototype = Object.create(THREE.Object3D.prototype)
Leaf.prototype.constructor = Leaf
Leaf.prototype.animate = function() {

}

function makeBranchGeometry(length, width) {
  var shape = new THREE.Shape();
  shape.moveTo( 0, -width/2 );
  shape.lineTo( length, -width/2)
  shape.lineTo( length + .1, 0)
  shape.lineTo( length, width/2)
  shape.lineTo( 0, width/2)
  shape.lineTo( -.1, 0)
  return new THREE.ShapeBufferGeometry( shape );
}
const BRANCH_GEOMETRY = makeBranchGeometry(1, 1);
const BRANCH_DEFAULTS = {
  width: 1, // branch width
  color: 0xFFFFFF, // mesh color
  length: 1, // current length in units
  lengthNeutral: 1, // neutral length in units
  compressionThreshold: .2, // neutral - threshold * neutral
  compressionLimit: 0.5, // neutral - limit * neutral
  stretchThreshold: .2, // neutral + threshold * neutral
  stretchLimit: 1., // neutral + limit *  neutral
  rotation: 0, // current angle in rad
  rotationNeutral: 0, // neutral angle in rad
  rotationThreshold: 0.025, // 90 deg
  rotationLimit: 0.25, // 180 deg
  dragDamping: 6,
}

function Branch(parent, opts) {
  Object.assign(this, BRANCH_DEFAULTS, opts)
  this.branches = this.branches || []
  if (!opts.hasOwnProperty("rotationNeutral")) {
    this.rotationNeutral = this.rotation
  }
  if (!opts.hasOwnProperty("lengthNeutral")) {
    this.lengthNeutral = this.length
  }


  this.targetLength = this.length
  this.targetRotation = this.rotation

  this.lengthForce = 0
  this.rotationForce = 0
  this.fixed = false

  this.parent = parent
  this.isRoot = !parent
  this.children = []


  this.material = new THREE.MeshBasicMaterial(
    {color: this.color, side: THREE.DoubleSide}
  )
  this.group = new THREE.Group()
  this.mesh = new THREE.Mesh(BRANCH_GEOMETRY, this.material)
  this.mesh.userData.reference = this
  this.group.add(this.mesh)
  this.subBranchGroup = new THREE.Group();
  this.group.add(this.subBranchGroup)
  this.branches.forEach((branch) => {
    let subBranch = new Branch(this, branch)
    this.children.push(subBranch)
    this.subBranchGroup.add(subBranch.group)
  })
}
Branch.prototype.constructor = Branch
Branch.prototype.updatePosition = function() {
  this.mesh.scale.x = this.length
  this.mesh.scale.y = this.width
  this.group.rotation.z = this.rotation
  this.subBranchGroup.position.x = this.length
}
Branch.prototype.solve = function() {
  const ln = this.lengthNeutral
  const compressionLimit = ln - this.compressionLimit * ln
  const compressionThreshold = ln - this.compressionThreshold * ln
  const stretchLimit =  ln + this.stretchLimit * ln
  const stretchThreshold =  ln + this.stretchThreshold * ln
  if (this.targetLength < compressionLimit) {
    this.targetLength = compressionLimit
  }
  if (this.targetLength < compressionThreshold) {
    this.lengthForce = (1 - (this.targetLength - compressionLimit) / (compressionThreshold - compressionLimit))
  }
  if (this.targetLength > stretchLimit) {
    this.targetLength = stretchLimit
  }
  if (this.targetLength > stretchThreshold) {
    this.lengthForce = -(this.targetLength - stretchThreshold) / (stretchLimit - stretchThreshold)
  }
  const rn = this.rotationNeutral
  const rotationLimit = this.rotationLimit * Math.PI
  const rotationThreshold = this.rotationThreshold * Math.PI
  const rotationDelta = calcAngleDelta(this.rotationNeutral, this.targetRotation)
  if (rotationDelta > rotationLimit) {
    this.targetRotation = this.rotationNeutral + rotationLimit
  }
  if (rotationDelta > rotationThreshold) {
    this.rotationForce = -(rotationDelta-rotationThreshold)/(rotationLimit-rotationThreshold)
  }
  if (rotationDelta < -rotationLimit) {
    this.targetRotation = this.rotationNeutral - rotationLimit
  }
  if (rotationDelta < -rotationThreshold) {
    this.rotationForce = (-rotationDelta-rotationThreshold)/(rotationLimit-rotationThreshold)
  }

  if (!this.fixed) {
    this.targetLength += 1 * this.lengthForce
    this.targetRotation += .01 * this.rotationForce
  }
}

Branch.prototype.setDragOffset = function(x, y) {
  let worldPosition = new THREE.Vector3()
  this.group.getWorldPosition(worldPosition)

  let dist = calcDistance(worldPosition, {x, y})
  this.dragOffset = dist - this.length
}
Branch.prototype.drag = function(x, y, factor) {

  if (factor == 0) return
  else if(!factor) factor = 1
  else factor /= this.dragDamping
  const ln = this.lengthNeutral
  const compressionLimit = ln - this.compressionLimit * ln
  const stretchLimit =  ln + this.stretchLimit * ln
  let worldPosition = new THREE.Vector3()
  this.group.getWorldPosition(worldPosition)
  let angle = calcAngle(worldPosition,{x, y})

  let dist = calcDistance(worldPosition, {x, y})
  if (this.fixed) {
    dist -= this.dragOffset
  }
  this.targetLength = this.targetLength + (dist-this.targetLength)* factor
  this.targetLength =  Math.max(compressionLimit, Math.min(this.targetLength, stretchLimit))
  this.targetRotation = this.targetRotation + calcAngleDelta(this.getWorldRotation(), angle) * factor
  if(!this.isRoot) {
    this.parent.drag(x, y, factor)
  }
}
Branch.prototype.move = function() {
  //if(this.targetRotation - this.rotation > .01)
    this.rotation += Math.max(Math.min(calcAngleDelta(this.rotation,this.targetRotation)/2, Math.PI/24), -Math.PI/24)
  //if(this.targetLength - this.length > 1)
    this.length +=  Math.max(Math.min((this.targetLength - this.length)/2, 4), -4)
}
Branch.prototype.getLevel = function() {
  if (!this.isRoot) {
    return this.parent.getLevel()+1
  } else {
    return 1
  }
}
Branch.prototype.getWorldRotation = function() {
  if (!this.isRoot) {
    return this.parent.getWorldRotation() + this.targetRotation
  } else {
    return this.targetRotation
  }
}
Branch.prototype.getTargetWorldPosition = function(vector) {
  vector.x += Math.cos(this.targetRotation) * this.targetLength
  vector.y += Math.sin(this.targetRotation) * this.targetLength
  if (!this.isRoot) {
    this.parent.getTargetWorldPosition(vector)
  } else {

    let worldPosition = new THREE.Vector3()
    //this.group.getWorldPosition(worldPosition)
    this.group.getWorldPosition(worldPosition)
    vector.x += worldPosition.x
    vector.y += worldPosition.y
  }
  return vector
}
Branch.prototype.update = function() {
  this.solve();
  this.move();
  this.updatePosition();
  for(var i = 0; i < this.children.length; i++) {
    this.children[i].update()
  }
}



const TREE_DEFAULTS = {
  model: {
    rotation: Math.PI/2,
    length: 10,
    width: 1
  }
}
function Tree(opts) {
  Object.assign(this, clone(TREE_DEFAULTS), opts)
  this.root = new Branch(null, this.model)
  this.group = new THREE.Group()
  this.group.add(this.root.group)
}
Tree.prototype.constructor = Tree
Tree.prototype.update = function() {
  this.root.update()
}

// WORLD
var WORLD_DEFAULTS = {
  width: 512,
  height: 512,
  maxCameraDistFactor: .8,
  cameraFollowFactor: .01
}

const TREE_1 = {
  model: {
    rotation: Math.PI/2,
    length: 100,
    width: 30,
    branches:[
      {
        rotation: -.03,
        length: 70,
        width: 30,
        branches: [
          {
            rotation: 1.03,
            length: 50,
            width: 20,
          },
          {
            rotation: -1.03,
            length: 50,
            width: 20,
          }
        ]
      },
      {
        rotation: 1.,
        length: 70,
        width: 30,
      }
    ]
  }
}

const TREE_2 = {
  model: {
    rotation: Math.PI/2,
    length: 100,
    width: 30,
    branches:[
      {
        rotation: -.0,
        length: 70,
        width: 25,
        branches: [
          {
            rotation: 1.03,
            length: 70,
            width: 20,
            branches: [
              {
                rotation: 0.93,
                length: 40,
                width: 15,
              },
              {
                rotation: -0.93,
                length: 40,
                width: 12,
              }
            ]
          },
          {
            rotation: -1.03,
            length: 60,
            width: 13,
            branches: [
              {
                rotation: 1.3,
                length: 39,
                width: 10,
              },
              {
                rotation: -0.93,
                length: 20,
                width: 8,
              }
            ]
          }
        ]
      },
      {
        rotation: 1.67,
        length: 70,
        width: 15,
        branches: [
          {
            rotation: 1.3,
            length: 39,
            width: 10,
          },
          {
            rotation: -0.93,
            length: 30,
            width: 12,
          }
        ]
      }
    ]
  }
}
function World(opts) {
  THREE.Scene.call(this)
  this.opts = Object.assign({}, WORLD_DEFAULTS, opts)
  this.objects = new THREE.Group()
  this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100)
  this.camera.position.z = 1;
  this.add(this.objects)
  this.tree = new Tree(TREE_2)
  this.objects.add(this.tree.group)

}
World.prototype = Object.create(THREE.Scene.prototype)
World.prototype.constructor = World
World.prototype.update = function() {
  this.tree.update()
}
World.prototype.setSize = function(width, height) {
  this.camera.left = -width/2
  this.camera.right = width/2
  this.camera.top =  height/2
  this.camera.bottom = -height/2
  this.tree.group.position.y = -height/2
  this.camera.updateProjectionMatrix()
}




// TEMPLATES
// STATIC DOM ELEMENTS

function Page(container) {
  this.container = container
}
Page.prototype.constructor = Page
Page.prototype.animate = function() {
  if (this.onAnimate) this.onAnimate()
}
Page.prototype.resize = function() {
  if (this.onResize) this.onResize()
}


const settingsTemplate = makeTemplate("#settings-template")
function SettingsPage() {
  Page.apply(this, arguments)
  console.log("new SettingsPage")
  replace(this.container, settingsTemplate)
}
SettingsPage.prototype = Object.create(Page.prototype)
SettingsPage.prototype.constructor = SettingsPage


const treeTemplate = makeTemplate("#tree-template")
function TreePage() {
  Page.apply(this, arguments)

  console.log("new TreePage")

  replace(this.container, treeTemplate)

  this.composite = document.querySelector('#tree')
  this.world = new World()


  this.screenCv = document.querySelector('#screen');

  this.viewSize = 20

  this.aspect = 1
  this.width = 1
  this.height = 1
  this.sceneWidth = this.viewSize*this.aspect //window.innerWidth
  this.sceneHeight = this.viewSize // window.innerHeight
	this.renderer = new THREE.WebGLRenderer({antialias: true,  canvas: this.screenCv})
  this.resize()

  this.raycaster = new THREE.Raycaster();
  this.mouse = new THREE.Vector2();
  this.selected

  this.screenCv.addEventListener("mousedown", this.onMouseDown.bind(this))
  this.screenCv.addEventListener("mouseup", this.onMouseUp.bind(this))
  this.screenCv.addEventListener("mousemove", this.onMouseMove.bind(this))
  this.screenCv.addEventListener("mouseleave", this.onMouseUp.bind(this))
  window.addEventListener("mouseout", this.onMouseUp.bind(this))

}
TreePage.prototype = Object.create(Page.prototype)
TreePage.prototype.constructor = TreePage
TreePage.prototype.onMouseUp = function( event ) {
  if (this.selected) {
    this.selected.fixed = false
    this.selected = null
  }
}
TreePage.prototype.onMouseDown = function( event ) {
  const bounds = event.target.getBoundingClientRect();
  this.mouse.x = ((event.clientX-bounds.left)/this.width) * 2 - 1
  this.mouse.y = -((event.clientY-bounds.top)/this.height)* 2 + 1
  this.raycaster.setFromCamera( this.mouse, this.world.camera );
  var intersects = this.raycaster.intersectObjects( this.world.objects.children, true );
  if (intersects.length) {
    intersects.sort((a,b) => {
      return a.distance - b.distance
    })
    this.selected = intersects[0].object.userData.reference
    this.selected.fixed = true
    this.selected.setDragOffset(
      this.mouse.x*this.width/2, this.mouse.y*this.height/2
    )
  }
}
TreePage.prototype.onMouseMove = function( event ) {
  if (!this.selected) return
  var bounds = event.target.getBoundingClientRect();
  this.mouse.x = ((event.clientX-bounds.left)/this.width) * 2 - 1
  this.mouse.y = -((event.clientY-bounds.top)/this.height)* 2 + 1
}
TreePage.prototype.resize = function() {
  this.width = this.composite.offsetWidth
  this.height = this.composite.offsetHeight
  this.renderer.setSize( this.width, this.height);
  this.world.setSize(this.width, this.height)
}
TreePage.prototype.animate = function() {
  if (this.selected) {
    this.selected.drag(this.mouse.x*this.width/2, this.mouse.y*this.height/2)
  }
  this.world.update()
  this.renderer.render( this.world, this.world.camera )
}





let page

var animate = function () {
  requestAnimationFrame( animate )
  if (page) page.animate()
}


function resize(){
  if (page) page.resize()
}

function setPage(name) {
  const content = document.querySelector('#content')
  switch(name) {
    case "tree":
      page = new TreePage(content)
    break
    case "settings":
      page = new SettingsPage(content)
    break
  }
}

window.addEventListener("load", e => {
  console.log(" window onload")




  /*const settingsButton = document.querySelector('#settings-button')
  settingsButton.addEventListener("click", (e) => {
    setPage("settings")
  })*/
  window.addEventListener("resize", resize)
  setPage("tree")
  requestAnimationFrame(animate)
})

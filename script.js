// this code may be great,
// it may be trash, i don't know
// i'm no scientist
//
// - a haiku by jonny
const SEGMENT_SIZE = 50; // size of a segment in the grid
const DRAG_RADIUS = SEGMENT_SIZE * 5; // radius of dragging pixels around mouse
const SNAP_BACK_DURATION = 1000; // snap back speed
const FRICTION = 0.5; // stretch friction
const WIREFRAME_MODE = false; // neked bones mode
const SPRITE_SPEED = 20; // sprite animation speed (based on 60fps)

const toggleOn = document.querySelector('.toggle-on');
const toggleOff = document.querySelector('.toggle-off');
const title = document.querySelector('.title');
const canvas = document.querySelector('.canvas');
const context = canvas.getContext('2d');
const bufferCanvas = document.createElement('canvas');
const bufferContext = bufferCanvas.getContext('2d');
const img = document.createElement('img');

let babyFrame = 0; // the current frame of the sprite animation
let gridSize = 0; // size of the grid
let points = []; // an array of all the draggable points
let segments = []; // an array of each square in the grid
let time = Date.now(); // the current draw time (set in our draw method)
let dragStart = { x: 0, y: 0 }; // the drag start point 
let dragPoints = []; // an array of any current dragging points
let isDragging = false;
let isFrankenBabyMode = false; // this is controlled by the toggle at the bottom of the page

// get the distance between two points
const getDistance = ({ x: x1, y: y1 }, { x: x2, y: y2 }) =>
Math.hypot(x2 - x1, y2 - y1);

// easey-breezy
const easeOutElastic = t => .04 * t / --t * Math.sin(25 * t);

// throttle function
const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// get linear soluuush
const getLinearSolution = (r1, s1, t1, r2, s2, t2, r3, s3, t3) => {
  r1 = parseFloat(r1);
  s1 = parseFloat(s1);
  t1 = parseFloat(t1);
  r2 = parseFloat(r2);
  s2 = parseFloat(s2);
  t2 = parseFloat(t2);
  r3 = parseFloat(r3);
  s3 = parseFloat(s3);
  t3 = parseFloat(t3);

  const a = ((t2 - t3) * (s1 - s2) - (t1 - t2) * (s2 - s3)) / ((r2 - r3) * (s1 - s2) - (r1 - r2) * (s2 - s3));
  const b = ((t2 - t3) * (r1 - r2) - (t1 - t2) * (r2 - r3)) / ((s2 - s3) * (r1 - r2) - (s1 - s2) * (r2 - r3));
  const c = t1 - r1 * a - s1 * b;

  return [a, b, c];
};

// create an array of points and an array 
// of segments with point references
const createPoints = () => {
  const size = Math.min(window.innerWidth, window.innerHeight);
  const segmentCount = Math.min(10, Math.floor(size / SEGMENT_SIZE));
  const totalSize = SEGMENT_SIZE * segmentCount;
  const midSize = totalSize / 2;
  const pointCount = segmentCount + 1;
  const pointTotal = pointCount * pointCount;
  const segmentTotal = segmentCount * segmentCount;
  const offsetX = window.innerWidth / 2 - midSize;
  const offsetY = window.innerHeight / 2 - midSize;

  gridSize = totalSize;

  // set title font size to overlay our baby nicely
  title.style.fontSize = `${gridSize * 0.12}px`;
  title.style.width = `${gridSize}px`;

  // create the array of vertices
  for (let i = 0; i < pointTotal; i++) {
    const x = i % pointCount * SEGMENT_SIZE;
    const y = Math.floor(i / pointCount) * SEGMENT_SIZE;
    points.push({
      x: offsetX + x, // x position (account for the canvas offset since we're centering)
      y: offsetY + y, // y position (account for the canvas offset since we're centering)
      dragX: 0, // the point's drag x (this is used to offset the point when dragging)
      dragY: 0, // the point's drag y (this is used to offset the point when dragging)
      letGoTime: 0, // the time the point was let go (this is set in our mouseup handler)
      isDragging: false // indicator if the current point is dragging or not (we don't want to start stretching it back if we're still dragging)
    });
  }

  // create an array of segments
  // there is probably a MUCH more efficient way to 
  // do this, but whatever... it's supposed to be fun
  for (let s = 0; s < segmentTotal; s++) {
    const offset = Math.floor(s / segmentCount); // offset indicating which row we're on
    const tl = s + offset; // top left point of this square
    const tr = s + offset + 1; // top right point of this square
    const bl = s + offset + pointCount; // bottom left point of this square
    const br = s + offset + pointCount + 1; // bottom right point of this square

    // segments is an array of references to indexes in our points array
    // I did this so that when a point is moved, any segment that contains 
    // that point automatically accounts for that.
    segments.push([tl, tr, bl, br]);
  }
};

// draw the grid
const draw = () => {
  time = Date.now(); // set the current draw time

  // resize the canvas to fill the screen
  // (doing this also clears the canvas)
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  context.strokeStyle = '#f00';

  // draw our image into a buffer canvas
  // this is needed in order to scale the image to our grid size.
  bufferCanvas.width = canvas.width * 2;
  bufferCanvas.height = canvas.height;
  bufferContext.drawImage(img, (canvas.width - gridSize) / 2, (canvas.height - gridSize) / 2, gridSize * 2, gridSize * 1.15);

  // loop through our segments and draw each one
  for (let i = 0; i < segments.length; i++) {
    // get references to each of our segment's corner points 
    const segment = segments[i];
    const spriteFrame = Math.round(babyFrame / SPRITE_SPEED);
    const { x: x1, y: y1, dragX: dragX1, dragY: dragY1 } = points[segment[0]];
    const { x: x2, y: y2, dragX: dragX2, dragY: dragY2 } = points[segment[1]];
    const { x: x3, y: y3, dragX: dragX3, dragY: dragY3 } = points[segment[2]];
    const { x: x4, y: y4, dragX: dragX4, dragY: dragY4 } = points[segment[3]];

    // get the data needed to create our transformation matrix
    const xm = getLinearSolution(0, 0, x1 + dragX1, SEGMENT_SIZE, 0, x2 + dragX2, 0, SEGMENT_SIZE, x3 + dragX3);
    const ym = getLinearSolution(0, 0, y1 + dragY1, SEGMENT_SIZE, 0, y2 + dragY2, 0, SEGMENT_SIZE, y3 + dragY3);
    const xn = getLinearSolution(SEGMENT_SIZE, SEGMENT_SIZE, x4 + dragX4, SEGMENT_SIZE, 0, x2 + dragX2, 0, SEGMENT_SIZE, x3 + dragX3);
    const yn = getLinearSolution(SEGMENT_SIZE, SEGMENT_SIZE, y4 + dragY4, SEGMENT_SIZE, 0, y2 + dragY2, 0, SEGMENT_SIZE, y3 + dragY3);

    // draw the first of our triangles
    // triangles are needed in order to properly skew our segments
    context.save();
    context.setTransform(xm[0], ym[0], xm[1], ym[1], xm[2], ym[2]);
    context.beginPath();
    context.moveTo(-1, -1);
    context.lineTo(SEGMENT_SIZE + 1, -1);
    context.lineTo(-1, SEGMENT_SIZE + 1);
    context.lineTo(-1, -1);
    context.closePath();
    context.clip();

    // if wireframe mode is on, add a stroke around the triangle. 
    // otherwise, draw our image into it
    if (WIREFRAME_MODE) {
      context.stroke();
    } else {
      context.drawImage(bufferCanvas, x1 + gridSize * spriteFrame, y1, SEGMENT_SIZE, SEGMENT_SIZE, -1, -1, SEGMENT_SIZE + 2, SEGMENT_SIZE + 2);
    }
    context.restore();

    // do the same thing for our other triangle to complete our segment square
    context.save();
    context.setTransform(xn[0], yn[0], xn[1], yn[1], xn[2], yn[2]);
    context.beginPath();
    context.moveTo(SEGMENT_SIZE, SEGMENT_SIZE);
    context.lineTo(SEGMENT_SIZE, 0);
    context.lineTo(SEGMENT_SIZE - 1, 0);
    context.lineTo(-1, SEGMENT_SIZE);
    context.lineTo(0, SEGMENT_SIZE);
    context.lineTo(SEGMENT_SIZE, SEGMENT_SIZE);
    context.closePath();
    context.clip();
    if (WIREFRAME_MODE) {
      context.stroke();
    } else {
      context.drawImage(bufferCanvas, x1 + gridSize * spriteFrame, y1, SEGMENT_SIZE, SEGMENT_SIZE, -1, -1, SEGMENT_SIZE + 2, SEGMENT_SIZE + 2);
    }
    context.restore();
  }

  // loop through our points and check which ones, if any, were dragged. 
  // if a point was dragged, we want to start stretching it back into place.
  if (!isFrankenBabyMode) {
    points.forEach(point => {
      const { dragX, dragY, isDragging, letGoDragX, letGoDragY, letGoTime } = point;
      if (!isDragging && letGoTime) {
        const transitionTime = time - letGoTime; // the time that has elapsed, in milliseconds, since our point was let go (or stopped dragging)
        const progress = easeOutElastic(1 - transitionTime / SNAP_BACK_DURATION); // the progress, 0 - 1, of our animation. this is based off our constant SNAP_BACK_DURATION

        // start snapping our point back based on the animation progress
        point.dragX = letGoDragX * progress;
        point.dragY = letGoDragY * progress;

        // if our SNAP_BACK_DURATION time has expired, 
        // reset the point's dragging data
        if (transitionTime > SNAP_BACK_DURATION) {
          point.letGoTime = 0;
          point.dragX = 0;
          point.dragY = 0;
        }
      }
    });
  }

  // increment baby frame counter
  babyFrame++;
  if (babyFrame > SPRITE_SPEED) {
    babyFrame = 0;
  }

  // draw it all over again! 
  // using requestAnimationFrame vs a setInterval has a lot of benefits. 
  // requestAnimationFrame lets the browser decide when it's best to 
  // to draw which results in good performance. requestAnimationFrame 
  // also helps slow down/stop the animation loop when the browser tab 
  // is no longer in focus.
  window.requestAnimationFrame(draw);
};

// mousedown/touchstart event handler
const onDragStart = e => {
  e.preventDefault();

  const { pageX, pageY } = e.touches ? e.touches[0] : e; // normalize mouse and touch events
  dragStart = { x: pageX, y: pageY }; // set the drag start point
  dragPoints = []; // clear any previous dragPoints

  // loop through our points and find the distance between it and our 
  // start point. if the distance is within our DRAG_RADIUS, we should 
  // start dragging it when the mouse moves.
  points.forEach((point, i) => {
    const { x, y, dragX, dragY } = point;
    const draggedPoint = { x: x + dragX, y: y + dragY }; // making sure we account for the distance this point has already dragged, in case it hasn't fully snapped back yet.
    const distance = getDistance(dragStart, draggedPoint); // get the distance between the point and our start point
    if (Math.abs(distance) <= DRAG_RADIUS) {
      point.isDragging = true; // the point was in our radius, so set that it's dragging
      dragPoints.push({
        index: i, // store a reference to the point's index
        strength: 1 - distance / DRAG_RADIUS, // strength indicates how far the point was from our drag start point. this is what makes the further away points move slower than the ones close to the mouse
        baseDragX: dragX, // set the base drag x to be used when we move the mouse
        baseDragY: dragY // set the base drag y to be used when we move the mouse
      });
    }
  });

  // set the global isDragging boolean 
  // this is used to prevent our mousemove handler 
  // from doing anything unless we're actually dragging.
  isDragging = true;
};

// mousemove/touchmove event handler
const onDrag = throttle(e => {
  e.preventDefault();

  if (!isDragging) return; // don't do anything if we aren't dragging

  // hide the title since the user knows they can drag now
  if (dragPoints.length > 0) {
    title.dataset.hide = true;
  }

  const { pageX, pageY } = e.touches ? e.touches[0] : e; // normalize mouse and touch events
  const { x: startX, y: startY } = dragStart; // get our drag start point
  const diffX = (pageX - startX) * FRICTION; // get how far we've moved the mouse on the x
  const diffY = (pageY - startY) * FRICTION; // get how far we've moved the mouse on the y
  dragPoints.forEach(({ index, strength, baseDragX, baseDragY }) => {
    points[index].dragX = baseDragX + diffX * strength; // set the dragX on the point to how far we moved on the x, making sure to account for the point's distance from our start (or "strength")
    points[index].dragY = baseDragY + diffY * strength; // set the dragY on the point to how far we moved on the y, making sure to account for the point's distance from our start (or "strength")
  });
}, 20);

// mouseup/touchend event handler
const onDragEnd = e => {
  e.preventDefault();

  isDragging = false; // reset the global isDragging boolean

  // loop through our points and check for our dragging points
  points.forEach((point, i) => {
    // if the point was being dragged, set data needed for 
    // the snap back animation
    if (point.isDragging) {
      points[i] = {
        ...point,
        letGoDragX: point.dragX, // the dragX at the time the point was let go
        letGoDragY: point.dragY, // the dragY at the time the point was let go
        letGoTime: Date.now(), // the time the point was let go
        isDragging: false // reset the isDragging boolean since we are no longer dragging this point
      };
    }
  });
};

const onToggleFrankenbabyOn = () => {
  toggleOn.dataset.active = true; // set on toggle to active
  toggleOff.dataset.active = false; // set off toggle to inactive
  isFrankenBabyMode = true; // turn on frankenbaby mode
};

const onToggleFrankenbabyOff = () => {
  toggleOn.dataset.active = false; // set on toggle to inactive
  toggleOff.dataset.active = true; // set off toggle to active
  isFrankenBabyMode = false; // turn off frankenbaby mode
};

// resize event handler
window.addEventListener('resize', () => {
  // there are a lot of calculations happening that are 
  // based on the window size. its much easier to just reset 
  // everything here when we resize instead of updating all 
  // our points.
  points = [];
  segments = [];
  createPoints();
});


// toggle events
toggleOn.addEventListener('click', onToggleFrankenbabyOn);
toggleOff.addEventListener('click', onToggleFrankenbabyOff);
toggleOn.addEventListener('touchstart', onToggleFrankenbabyOn);
toggleOff.addEventListener('touchstart', onToggleFrankenbabyOff);

// drag events
document.addEventListener('mousedown', onDragStart);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchstart', onDragStart, { passive: false });
document.addEventListener('touchmove', onDrag, { passive: false });
document.addEventListener('touchend', onDragEnd, { passive: false });

// please don't steal my artwork. 
// I work very hard on it!
img.src = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/59639/cry-baby.jpg?666';

createPoints(); // create our array of points and segments
draw(); // start the draw loop
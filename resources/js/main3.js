import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import dat from "dat.gui";
import { gsap } from "gsap";
import { MeshStandardMaterial } from "three";

const DEBUG = location.search.indexOf("debug") > -1;

const threeProject = (() => {
	let loadingManager, scene, renderer, camera, ambientLight, directionalLight, gltfLoader, url, model, textureLoader, requestToRender, raf;
	let geometry, material, mesh, meshArea, scale, imageNo, initScrollTop, sceneUnit;

	let areaWidth = window.innerWidth;
	let areaHeight = window.innerHeight;

	const listCount = document.getElementsByClassName("listitem").length;
	let listArray = [];
	let imagesList = [];
	let targetMesh = null;

	initScrollTop = scrollY;

	//Image Setting
	for (let i = 1; i <= 19; i++) {
		imageNo = String(i).padStart(2, "0");
		let images = `../resources/images/IMG_0${imageNo}.jpg`;
		imagesList.push(images);
	}

	const setTheManager = () => {
		loadingManager = new THREE.LoadingManager();
		loadingManager.onLoad = () => {};
		loadingManager.onStart = () => {};
		loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {};
	};

	const setTheScene = () => {
		scene = new THREE.Scene();
	};

	const setTheRenderer = () => {
		renderer = new THREE.WebGLRenderer({
			antialias: true,
		});
		renderer.setClearColor(0xffffff, 0);
		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);
		renderer.outputEncoding = THREE.sRGBEncoding;
		document.body.appendChild(renderer.domElement);
	};

	const setTheCamera = () => {
		camera = new THREE.PerspectiveCamera(45, areaWidth / areaHeight, 1, 100);
		camera.position.z = 3;
	};

	const setTheLight = () => {
		ambientLight = new THREE.AmbientLight("#fff", 1);
		directionalLight = new THREE.DirectionalLight("#fff", 1);

		scene.add(ambientLight, directionalLight);
	};

	// 공통 적용할 uniform
	const sharedUniforms = {
		u_time: { value: 0 },
	};
	// 보통은 아래처럼 Object.assign으로 공통 적용할 uniform을 지정하지만
	// material을 clone해서 쓰고 있으니
	// cloneMaterial.uniforms.u_time = sharedUniforms.u_time; 형태로 지정
	// new THREE.ShaderMaterial({
	//   uniforms: Object.assign({
	//     u_progress: { value: 0 }
	//     ...
	//   }, sharedUniforms),
	//   vertexShader: ...,
	//   fragmentShader: document.querySelector('#fragment-shader-full').innerText
	// })

	const setTheLayout = () => {
		geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
		material = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			depthTest: false,
			// wireframe: true,
			uniforms: {
				u_pixels: { value: new THREE.Vector2(areaWidth, areaHeight) },
				u_alpha: { value: 1.0 },
				u_position: { value: new THREE.Vector2(0.0, 0.0) },
				u_accel: { value: new THREE.Vector2(0.5, 2.0) },
				u_progress: { value: 0 },
				u_uvRate1: {
					value: new THREE.Vector2(1, 0.75),
				},
				u_texture1: { value: new THREE.TextureLoader().load("../resources/images/IMG_001.jpg") },
				u_texture2: { value: new THREE.TextureLoader().load("../resources/images/IMG_002.jpg") },
				u_hover: { value: new THREE.Vector3() },
			},
			vertexShader: `
      #define PI 3.141592653589793

			uniform vec3 u_hover;
			uniform float u_time;
			uniform vec2 u_position;

      varying vec2 v_uv;
      varying vec2 v_uv1;

      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform vec2 u_pixels;
      uniform vec2 u_uvRate1;

			void main() {
        v_uv = uv;
        vec2 _uv = uv - 0.5;
        // v_uv1 = _uv;
        // v_uv1 *= u_uvRate1.xy;

        // v_uv1 +=0.5;
        v_uv1 = uv;

				vec2 xy = uv;
				xy -= u_hover.xy;
				xy *= u_uvRate1;
    
			  float z = sin((length(xy) - u_time) * PI * 15.0) * 0.07 * u_hover.z;
        float mask = pow(1.0 - length(xy), 5.0);
    		z *= mask;

        vec3 _position = vec3(position.x , position.y, position.z + z);
        _position.x += u_position.x;

				gl_Position = projectionMatrix * modelViewMatrix * vec4(_position, 1.0);
			}
      `,
			fragmentShader: `
        uniform float u_time;
        uniform float u_progress;
        uniform float u_alpha;
        uniform sampler2D u_texture1;
        uniform sampler2D u_texture2;
        uniform vec2 u_pixels;
        uniform vec2 u_uvRate1;
        uniform vec2 u_accel;

        varying vec2 v_uv;
        varying vec2 v_uv1;

        vec2 mirrored(vec2 v){
          vec2 m = mod(v,2.0);
          return mix(m,2.0 - m, step(1.0,m));
        }

        float tri(float p) {
          return mix(p,1.0 - p, step(0.5 ,p))*2.;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy/u_pixels.xy;

          float p = fract(u_progress);

          float delayValue = p*7. - uv.y*2. + uv.x - 2.;

          delayValue = clamp(delayValue,0.0,1.0);

          vec2 translateValue = p + delayValue * u_accel;
          vec2 translateValue1 = vec2(-0.5,1.0)* translateValue;
          vec2 translateValue2 = vec2(-0.5,1.0)* (translateValue - 1. - u_accel);

          vec2 w = sin( sin(u_time)*vec2(0.0,0.3) + v_uv.yx*vec2(0.0,4.0))*vec2(0.0,0.5);
          vec2 xy = w*(tri(p)*0.5 + tri(delayValue)*0.5);

          vec2 uv1 = v_uv1 + translateValue1 + xy;
          vec2 uv2 = v_uv1 + translateValue2 + xy;

          vec4 rgba1 = texture2D(u_texture1,mirrored(uv1));
          vec4 rgba2 = texture2D(u_texture2,mirrored(uv2));

          vec4 rgba = mix(rgba1,rgba2,delayValue);

          gl_FragColor = vec4(rgba);
          gl_FragColor.a = u_alpha;
        }
      `,
			// color: "#555555",
			// wireframe: true,
			// wireframeLinewidth: 1.1,
		});

		for (let i = 0; i < listCount; i++) {
			const cloneMaterial = material.clone();
			cloneMaterial.uniforms.u_time = sharedUniforms.u_time; // 공통 uniform 적용
			cloneMaterial.uniforms.u_texture1.value = new THREE.TextureLoader().load(imagesList[i]);
			cloneMaterial.uniforms.u_texture2.value = new THREE.TextureLoader().load(imagesList[i + 1 >= listCount ? 0 : i + 1]);
			mesh = new THREE.Mesh(geometry, cloneMaterial);
			scene.add(mesh);
			listArray.push(mesh);
		}
	};

	const setTheSizing = () => {
		const listItems = document.querySelectorAll(".listitem img");
		// let meshPosition = mesh.position;
		// let cameraDistanceFromMesh = camera.position.distanceTo(meshPosition);
		sceneUnit = 2 * (camera.position.z - listArray[0].position.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
		sceneUnit /= areaHeight;

		const scrollTop = window.pageYOffset;
		listArray.forEach((mesh, index) => {
			const rect = listItems[index].getBoundingClientRect();

			mesh.scale.set(rect.width * sceneUnit, rect.height * sceneUnit, 1);
			mesh.position.x = (rect.left + rect.width / 2 - areaWidth / 2) * sceneUnit;
			mesh.position.y = -(rect.top + scrollTop + rect.height / 2 - areaHeight / 2) * sceneUnit;
			mesh.userData.offsetY = -(rect.top + scrollTop + rect.height / 2 - areaHeight / 2) * sceneUnit;
			mesh.userData.scale = mesh.scale.clone();
			mesh.userData.position = mesh.position.clone();
		});
	};

	function onScroll() {
		const scrollTop = window.pageYOffset;

		for (let i = 0; i < listArray.length; i++) {
			const plane = listArray[i];
			plane.position.y = plane.userData.offsetY + scrollTop * sceneUnit;
		}
	}

	//Scroll
	window.addEventListener("scroll", onScroll);

	const setTheTexture = () => {
		textureLoader = new THREE.TextureLoader(loadingManager);
	};

	const setTheRaycaster = () => {
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let scaleUnit = 1.2;

		const popupMesh = document.querySelectorAll(".listitem a");
		for (let i = 0; i < popupMesh.length; i++) {
			popupMesh[i].addEventListener("mouseenter", enterMesh);
		}

		function enterMesh(e) {
			if (targetMesh) return;

			const targetElement = e.target.tagName !== "LI" ? e.target.closest("li") : e.target;
			const parentNode = [...targetElement.parentElement.children];
			const targetIndex = parentNode.indexOf(targetElement);

			const plane = listArray[targetIndex];
			const planeProgressUniform = plane.material.uniforms.u_progress;

			plane.renderOrder = 1;
			plane.material.uniforms.u_alpha.value = 1.0;

			plane.userData.progressTween && plane.userData.progressTween.kill();
			plane.userData.progressTween = gsap.to(planeProgressUniform, 0.75, {
				value: 0.99999,
				ease: "cubic.out",
			});

			plane.scale.hoverTween && plane.scale.hoverTween.kill();
			plane.scale.hoverTween = gsap.to(plane.scale, 0.75, {
				x: plane.userData.scale.x * scaleUnit,
				y: plane.userData.scale.y * scaleUnit,
				ease: "cubic.out",
			});

			targetElement.addEventListener("mousedown", clickMesh);
			targetElement.addEventListener("mouseleave", leaveMesh);
			targetElement.addEventListener("mousemove", moveMesh);
		}

		function clickMesh(e) {
			document.body.style.overflow = "hidden";

			const targetElement = e.target.tagName !== "LI" ? e.target.closest("li") : e.target;
			const parentNode = [...targetElement.parentElement.children];
			const targetIndex = parentNode.indexOf(targetElement);

			const plane = listArray[targetIndex];

			const planeHoverUniform = plane.material.uniforms.u_hover.value;
			const planeProgressUniform = plane.material.uniforms.u_progress;

			targetMesh = plane;

			plane.position.hoverTween && plane.position.hoverTween.kill();
			plane.position.hoverTween = gsap.to(plane.position, 0.75, {
				x: 0,
				y: 0,
				z: 0,
				ease: "cubic.out",
			});

			plane.scale.clickTween && plane.scale.clickTween.kill();
			plane.scale.clickTween = gsap.to(plane.scale, 0.75, {
				x: sceneUnit * areaHeight * 1.33,
				y: sceneUnit * areaHeight,
				ease: "cubic.out",
			});

			plane.userData.hoverTween && plane.userData.hoverTween.kill();
			plane.userData.hoverTween = gsap.to(planeHoverUniform, 0.75, {
				x: 0,
				y: 0,
				z: 0,
				ease: "cubic.out",
			});

			plane.userData.progressTween && plane.userData.progressTween.kill();
			plane.userData.progressTween = gsap.to(planeProgressUniform, 0.75, {
				value: 0,
				ease: "cubic.out",
			});

			targetElement.removeEventListener("mouseleave", leaveMesh);
			targetElement.removeEventListener("mousemove", moveMesh);
		}

		function moveMesh(e) {
			const targetElement = e.target.tagName !== "LI" ? e.target.closest("li") : e.target;
			const parentNode = [...targetElement.parentElement.children];
			const targetIndex = parentNode.indexOf(targetElement);

			const plane = listArray[targetIndex];

			pointer.x = (e.clientX / areaWidth) * 2 - 1;
			pointer.y = -(e.clientY / areaHeight) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);

			const intersected = raycaster.intersectObjects(listArray);

			if (intersected[0]) {
				const planeHoverUniform = plane.material.uniforms.u_hover.value;

				if (!planeHoverUniform.z) {
					planeHoverUniform.x = intersected[0].uv.x;
					planeHoverUniform.y = intersected[0].uv.y;
				}

				plane.userData.hoverTween && plane.userData.hoverTween.kill();
				plane.userData.hoverTween = gsap.to(planeHoverUniform, 0.75, {
					x: intersected[0].uv.x,
					y: intersected[0].uv.y,
					z: 1,
					ease: "cubic.out",
				});

				plane.position.hoverTween && plane.position.hoverTween.kill();
				plane.position.hoverTween = gsap.to(plane.position, 0.75, {
					x: plane.userData.position.x + (plane.userData.position.x - intersected[0].point.x) * (scaleUnit - 1),
					ease: "cubic.out",
				});
			}
		}

		function leaveMesh(e) {
			const targetElement = e.target.tagName !== "LI" ? e.target.closest("li") : e.target;
			const parentNode = [...targetElement.parentElement.children];
			const targetIndex = parentNode.indexOf(targetElement);

			const plane = listArray[targetIndex];
			const planeProgressUniform = plane.material.uniforms.u_progress;
			const planeHoverUniform = plane.material.uniforms.u_hover.value;

			plane.renderOrder = 0;

			plane.userData.hoverTween && plane.userData.hoverTween.kill();
			plane.userData.hoverTween = gsap.to(planeHoverUniform, 0.5, {
				x: 0,
				y: 0,
				z: 0,
				ease: "cubic.out",
			});

			plane.userData.progressTween && plane.userData.progressTween.kill();
			plane.userData.progressTween = gsap.to(planeProgressUniform, 0.5, {
				value: 0,
				ease: "cubic.out",
				onComplete: function () {
					plane.material.uniforms.u_alpha.value = 1.0;
				},
			});

			plane.scale.hoverTween && plane.scale.hoverTween.kill();
			plane.scale.hoverTween = gsap.to(plane.scale, 0.5, {
				x: plane.userData.scale.x,
				y: plane.userData.scale.y,
				ease: "cubic.out",
			});

			plane.position.hoverTween && plane.position.hoverTween.kill();
			plane.position.hoverTween = gsap.to(plane.position, 0.5, {
				x: plane.userData.position.x,
				ease: "cubic.out",
			});

			targetElement.removeEventListener("mouseleave", leaveMesh);
			targetElement.removeEventListener("mousemove", moveMesh);
		}

		gsap.ticker.add(animate);

		function animate(time, deltaTime) {
			sharedUniforms.u_time.value += deltaTime * 0.0001;
			renderer.render(scene, camera);
		}
	};

	const closeBtn = document.querySelector(".btn-menu");
	closeBtn.addEventListener("click", function () {
		document.body.style.overflow = "visible";

		targetMesh.scale.clickTween && targetMesh.scale.clickTween.kill();
		targetMesh.scale.clickTween = gsap.to(targetMesh.scale, 0.5, {
			x: targetMesh.userData.scale.x,
			y: targetMesh.userData.scale.y,
			ease: "cubic.out",
			onComplete: function () {
				targetMesh.renderOrder = 0;
				targetMesh.material.uniforms.u_alpha.value = 0.0;
				targetMesh = null;
			},
		});

		targetMesh.position.hoverTween && targetMesh.position.hoverTween.kill();
		targetMesh.position.hoverTween = gsap.to(targetMesh.position, 0.5, {
			x: targetMesh.userData.position.x,
			y: targetMesh.userData.position.y,
			ease: "cubic.out",
		});
	});

	// gsap.ticker에서 render를 계속 실행하고 있어서 필요없음
	// const setTheRender = () => {
	// if (requestToRender) {
	// 	renderer.render(scene, camera);
	// 	requestToRender = false;
	// }
	// raf = requestAnimationFrame(setTheRender);
	// };

	const renderRequest = () => {
		// gsap.ticker에서 render를 계속 실행하고 있어서 필요없음
		// requestToRender = true;
	};

	const resize = () => {
		areaWidth = window.innerWidth;
		areaHeight = window.innerHeight;
		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
		setTheSizing();
		onScroll();
		camera.aspect = areaWidth / areaHeight;
		camera.updateProjectionMatrix();
		renderRequest();
	};

	const addEvent = () => {
		window.addEventListener("resize", resize);
	};

	const debugMode = () => {
		if (DEBUG) {
			let gui = new dat.GUI();
			gui.domElement.parentNode.style.zIndex = 100;

			const control = new OrbitControls(camera, renderer.domElement);
			control.addEventListener("change", function () {
				renderRequest();
			});

			scene.add(new THREE.AxesHelper());

			gui && gui.add(camera.position, "y", 0, 2, 0.00001).name("camera y").onChange(renderRequest);
			gui &&
				gui
					.add(mesh.rotation, "x", -Math.PI, Math.PI, Math.PI / 180)
					.name("model rotation x")
					.onChange(renderRequest);
			gui &&
				gui
					.add(mesh.rotation, "y", -Math.PI, Math.PI, Math.PI / 180)
					.name("model rotation y")
					.onChange(renderRequest);
			gui &&
				gui
					.add(mesh.rotation, "z", -Math.PI, Math.PI, Math.PI / 180)
					.name("model rotation z")
					.onChange(renderRequest);
		}
	};

	const initialize = () => {
		setTheManager();
		setTheScene();
		setTheRenderer();
		setTheCamera();
		setTheLight();
		setTheLayout();
		setTheSizing();
		setTheTexture();
		setTheRaycaster();
		// setTheRender();
		addEvent();
		debugMode();
	};

	return {
		init: initialize,
	};
})();

onload = threeProject.init();

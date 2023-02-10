import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import dat from "dat.gui";
import { gsap } from "gsap";

const DEBUG = location.search.indexOf("debug") > -1;

const threeProject = (() => {
	let loadingManager, scene, renderer, camera, ambientLight, directionalLight, gltfLoader, url, model, textureLoader, requestToRender, raf;
	let geometry, material, mesh, meshArea, scale, imageNo, initScrollTop;

	let areaWidth = window.innerWidth;
	let areaHeight = window.innerHeight;

	const listCount = document.getElementsByClassName("listitem").length;
	let listArray = [];
	let imagesList = [];
	let boxGap = { x: 0.25, y: 0.503 };
	const listColumn = 3;

	let meshWidth, meshHeight, meshDepth;

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
		geometry = new THREE.PlaneGeometry(1.33, 1, 32, 32);
		material = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			depthTest: false,
			// wireframe: true,
			uniforms: {
				u_pixels: { value: new THREE.Vector2(areaWidth, areaHeight) },
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

          gl_FragColor = rgba;
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

	const setTheModel = () => {
		gltfLoader = new GLTFLoader();
		// url = "./";

		// gltfLoader.load(url, (object) => {
		//   model = object;
		//   scene.add(model.scene);
		// });

		renderRequest();
	};

	const setTheSizing = () => {
		const size = new THREE.Box3().setFromObject(mesh);

		meshWidth = size.max.x - size.min.x;
		meshHeight = size.max.y - size.min.y;
		meshDepth = size.max.z - size.min.z;

		let meshPosition = mesh.position;
		let cameraDistanceFromMesh = camera.position.distanceTo(meshPosition);
		let targetHeight = meshHeight / 2;

		cameraDistanceFromMesh -= meshDepth / 2;
		camera.fov = (180 / Math.PI) * Math.atan(targetHeight / cameraDistanceFromMesh) * 2; //Cube 100% fit to the screen size
		// camera.fov = (180 / Math.PI) * Math.atan(targetHeight / cameraDistanceFromMesh) * 2 * 4.85; //Cube 50% fit to the screen size

		camera.updateProjectionMatrix();

		meshArea = document.querySelector(".listitem img");
		scale = meshArea.offsetHeight / areaHeight;

		setViewOffsetFunction();

		for (let i = 0; i < listArray.length; i++) {
			const item = listArray[i];

			item.position.x = (meshWidth + boxGap.x) * scale * (i % listColumn);
			item.position.y = -(meshHeight + boxGap.y) * scale * Math.floor(i / listColumn);
			item.savePosition = item.position.clone();
			item.scale.set(scale, scale);
		}
	};

	const setViewOffsetFunction = () => {
		const firstImg = document.querySelectorAll(".listitem img")[0];
		const meshRect = firstImg.getBoundingClientRect();

		camera.setViewOffset(
			areaWidth,
			areaHeight,
			areaWidth / 2 - meshRect.width / 2 - (meshRect.left - 0), // offset x
			areaHeight / 2 - meshRect.height / 2 - (meshRect.top - 0), // offset y
			areaWidth,
			areaHeight
		);
	};

	//Scroll
	window.addEventListener("scroll", function () {
		const scrollRatio = scrollY / areaHeight;

		for (let i = 0; i < listArray.length; i++) {
			listArray[i].position.y = listArray[i].savePosition.y + scrollRatio;
		}
	});

	const setTheTexture = () => {
		textureLoader = new THREE.TextureLoader(loadingManager);
	};

	const setTheRaycaster = () => {
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let currentMesh;

		document.addEventListener("mousemove", function (e) {
			pointer.x = (e.clientX / areaWidth) * 2 - 1;
			pointer.y = -(e.clientY / areaHeight) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);

			const intersected = raycaster.intersectObjects(listArray);
			if (intersected[0]) {
				const mesh = intersected[0].object;
				const meshHoverUniform = mesh.material.uniforms.u_hover.value;
				const meshPositionUniform = mesh.material.uniforms.u_position.value;

				if (!meshHoverUniform.z) {
					meshHoverUniform.x = intersected[0].uv.x;
					meshHoverUniform.y = intersected[0].uv.y;
				}
				mesh.userData.hoverTween && mesh.userData.hoverTween.kill();
				mesh.userData.hoverTween = gsap.to(meshHoverUniform, 0.75, {
					x: intersected[0].uv.x,
					y: intersected[0].uv.y,
					z: 1,
					ease: "cubic.out",
				});

				mesh.position.hoverTween && mesh.position.hoverTween.kill();
				mesh.position.hoverTween = gsap.to(meshPositionUniform, 0.75, {
					x: mesh.position.x - intersected[0].point.x,
					ease: "cubic.out",
				});

				// intersected mesh가 currentMesh랑 같으면 필요한 부분만 업데이트하고 이후 처리는 무시
				if (intersected[0].object === currentMesh) {
					return;
				}

				const meshProgressUniform = mesh.material.uniforms.u_progress;

				// 기존 currentMesh의 효과 제거
				// 동일한 액션을 intersected mesh가 없을 때도 재사용하기위해 leaveMesh 함수로 별도 분리
				currentMesh && leaveMesh(currentMesh);

				currentMesh = mesh;

				mesh.renderOrder = 1;

				mesh.userData.progressTween && mesh.userData.progressTween.kill();
				mesh.userData.progressTween = gsap.to(meshProgressUniform, 0.75, {
					value: 0.99999,
					ease: "cubic.out",
				});

				mesh.scale.hoverTween && mesh.scale.hoverTween.kill();
				mesh.scale.hoverTween = gsap.to(mesh.scale, 0.75, {
					x: scale * 1.2,
					y: scale * 1.2,
					ease: "cubic.out",
				});
			} else if (currentMesh) {
				// currentMesh가 있으면
				// 기존 currentMesh의 효과 제거
				// 동일한 액션을 intersected mesh가 없을 때도 재사용하기위해 leaveMesh 함수로 별도 분리
				leaveMesh(currentMesh);

				currentMesh = null;
			}

			// 전체를 순회할 필요는 없음
			// for (let i = 0; i < listArray.length; i++) {
			// 	const mesh = listArray[i];
			// 	const meshHoverUniform = mesh.material.uniforms.u_hover.value;
			// 	const meshProgressUniform = mesh.material.uniforms.u_progress;
			// 	const meshPositionUniform = mesh.material.uniforms.u_position.value;

			// 	if (currentMesh == mesh) break;

			// 	mesh.userData.hoverTween && mesh.userData.hoverTween.kill();
			// 	mesh.userData.hoverTween = gsap.to(meshHoverUniform, 0.5, { z: 0, ease: "cubic.out" });

			// 	mesh.userData.progressTween && mesh.userData.progressTween.kill();
			// 	mesh.userData.progressTween = gsap.to(meshProgressUniform, 0.5, { value: 0, ease: "cubic.out" });

			// 	mesh.scale.hoverTween && mesh.scale.hoverTween.kill();
			// 	mesh.scale.hoverTween = gsap.to(mesh.scale, 0.5, { x: scale, y: scale, ease: "cubic.out" });

			// 	mesh.position.hoverTween && mesh.position.hoverTween.kill();
			// 	mesh.position.hoverTween = gsap.to(meshPositionUniform, 0.5, { x: 0, ease: "cubic.out" });
			// }
		});

		// document.addEventListener("click", function () {
		// 	console.log("check");
		// });

		function leaveMesh(mesh) {
			mesh.renderOrder = 0;
			const meshHoverUniform = mesh.material.uniforms.u_hover.value;
			const meshProgressUniform = mesh.material.uniforms.u_progress;
			const meshPositionUniform = mesh.material.uniforms.u_position.value;
			mesh.userData.hoverTween && mesh.userData.hoverTween.kill();
			mesh.userData.hoverTween = gsap.to(meshHoverUniform, 0.5, { z: 0, ease: "cubic.out" });

			mesh.userData.progressTween && mesh.userData.progressTween.kill();
			mesh.userData.progressTween = gsap.to(meshProgressUniform, 0.5, { value: 0, ease: "cubic.out" });

			mesh.scale.hoverTween && mesh.scale.hoverTween.kill();
			mesh.scale.hoverTween = gsap.to(mesh.scale, 0.5, { x: scale, y: scale, ease: "cubic.out" });

			mesh.position.hoverTween && mesh.position.hoverTween.kill();
			mesh.position.hoverTween = gsap.to(meshPositionUniform, 0.5, { x: 0, ease: "cubic.out" });
		}

		gsap.ticker.add(animate);

		function animate(time, deltaTime) {
			sharedUniforms.u_time.value += deltaTime * 0.0001;
			renderer.render(scene, camera);
		}
	};

	// gsap.ticker에서 render를 계속 실행하고 있어서 필요없음
	const setTheRender = () => {
		// if (requestToRender) {
		// 	renderer.render(scene, camera);
		// 	requestToRender = false;
		// }
		// raf = requestAnimationFrame(setTheRender);
	};

	const renderRequest = () => {
		// gsap.ticker에서 render를 계속 실행하고 있어서 필요없음
		// requestToRender = true;
	};

	const resize = () => {
		areaWidth = window.innerWidth;
		areaHeight = window.innerHeight;
		renderer.setSize(areaWidth, areaHeight);
		renderer.setPixelRatio(devicePixelRatio);

		scale = meshArea.offsetHeight / areaHeight;
		for (let i = 0; i < listArray.length; i++) {
			const item = listArray[i];

			item.position.x = (meshWidth + boxGap.x) * scale * (i % listColumn);
			item.position.y = -(meshHeight + boxGap.y) * scale * Math.floor(i / listColumn);
			item.savePosition = item.position.clone();
			item.scale.set(scale, scale);
		}

		setViewOffsetFunction();
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
		// setTheModel();
		setTheLayout();
		setTheSizing();
		setTheTexture();
		setTheRaycaster();
		setTheRender();
		addEvent();
		debugMode();
	};

	return {
		init: initialize,
	};
})();

onload = threeProject.init();

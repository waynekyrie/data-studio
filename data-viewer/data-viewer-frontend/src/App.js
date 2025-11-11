import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Camera, Grid3x3, ZoomIn, LogOut, RefreshCw, Server } from 'lucide-react';

export default function AssetViewer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assets, setAssets] = useState([]);
  const [allAssetFiles, setAllAssetFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);

  // Number of assets to show per session (change this number as needed)
  const SAMPLE_SIZE = 20;

  // Function to randomly sample assets
  const sampleAssets = (allFiles, sampleSize) => {
    const shuffled = [...allFiles].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(sampleSize, allFiles.length));
    return selected.map(file => ({
      category: file.category,
      path: `${serverUrl}${file.filename[0]}`,
      description: file.filename[1]
    }));
  };

  // Load the file list from remote server
    useEffect(() => {
      if (!isLoggedIn) return;
  
      const loadFileList = async () => {
        setLoadingList(true);
        try {
          const response = await fetch(`${serverUrl}/data/lego/data/dataset.json`);
          console.log('Fetching dataset.json from', `${serverUrl}/data/lego/data/dataset.json`);
          if (!response.ok) {
            throw new Error('Could not load dataset.json from server');
          }
          const data = await response.json();
          console.log('Loaded file list:', data);
          
          if (!data || Object.keys(data).length === 0) {
          throw new Error('dataset.json is empty or invalid');
        }
  
        // ✅ Flatten the structure into a single array of { category, filename }
        const allFiles = Object.entries(data).flatMap(([category, filenames]) => {
          // Make sure filenames is an array
          if (!Array.isArray(filenames)) return [];
          
          return filenames.map(filename => ({
            category,
            filename,
          }));
        });
          console.log("All files:", allFiles);
          
          setAllAssetFiles(allFiles);
          console.log("Fetched: ", allAssetFiles);
          setLoadingList(false);
        } catch (err) {
          console.error('Error loading file list:', err);
          setError(`Failed to load file list from ${serverUrl}/data/lego/data/dataset.json. Make sure server is running and dataset.json exists.`);
          setLoadingList(false);
        }
      };
  
      loadFileList();
      
    }, [isLoggedIn, serverUrl]);

  // Sample assets when file list is loaded
  useEffect(() => {
    if (allAssetFiles.length > 0 && assets.length === 0) {
      const sampledAssets = sampleAssets(allAssetFiles, SAMPLE_SIZE);
      setAssets(sampledAssets);
    }
  }, [allAssetFiles]);

  // Shuffle button handler
  const handleShuffle = () => {
    if (allAssetFiles.length > 0) {
      const sampledAssets = sampleAssets(allAssetFiles, SAMPLE_SIZE);
      setAssets(sampledAssets);
      setSelectedAsset(null);
    }
  };

  useEffect(() => {
    if (!selectedAsset || !mountRef.current) return;

    setError(null);
    
    // Setup Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    // Grid helper
    // const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    // scene.add(gridHelper);

    // Load GLB file
    const loader = new GLTFLoader();
    let loadedObject = null;
    let pivot = null;

    loader.load(
      selectedAsset.path,
      (gltf) => {
        const object = gltf.scene;
        
        // Calculate bounding box and center
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        
        // Create a pivot point at the origin
        pivot = new THREE.Group();
        scene.add(pivot);
        
        // Add object to pivot and offset it so its center is at pivot's origin
        object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        object.scale.set(scale, scale, scale);
        pivot.add(object);
        
        loadedObject = pivot;
        setLoading(false);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log(`Loading: ${percentComplete.toFixed(2)}%`);
        }
      },
      (error) => {
        console.error('Error loading GLB:', error);
        setError(`Failed to load "${selectedAsset.name}". Check server connection and CORS settings.`);
        setLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      if (loadedObject) {
        loadedObject.rotation.y += 0.005;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Mouse controls for rotation and zoom
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging || !loadedObject) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      loadedObject.rotation.y += deltaX * 0.01;
      loadedObject.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      camera.position.z += e.deltaY * zoomSpeed * 0.01;
      camera.position.z = Math.max(2, Math.min(20, camera.position.z));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [selectedAsset]);

  const handleLogin = () => {
    if (email && serverUrl) {
      setIsLoggedIn(true);
      setError(null);
    }
  };

  const handleAssetClick = (asset) => {
    setLoading(true);
    setError(null);
    setSelectedAsset(asset);
  };

  if (loadingList) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading file list from server...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Grid3x3 className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">BrickGPT Studio</h1>
            <p className="text-gray-600">Sign in to explore your 3D collection</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Grid3x3 className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold">BrickGPT Studio</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-700 px-3 py-1 rounded-full">
              <Server className="w-3 h-3" />
              {serverUrl}
            </div>
            {allAssetFiles.length > 0 && (
              <div className="text-xs text-gray-400">
                {allAssetFiles.length} total • {assets.length} shown
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShuffle}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Shuffle
            </button>
            <button
              onClick={() => {
                setIsLoggedIn(false);
                setAssets([]);
                setAllAssetFiles([]);
                setSelectedAsset(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              Current Selection ({assets.length})
            </h2>
            {error && !selectedAsset && (
              <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              {assets.map((asset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAssetClick(asset)}
                  className={`w-full text-left p-4 rounded-lg transition-all ${
                    selectedAsset?.name === asset.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-l font-bold  opacity-90 mt-1">{asset.description}</div>
                  {/* <div className="text-xs opacity-75 mt-1 truncate">{asset.path}</div> */}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedAsset ? (
            <>
              <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold">{selectedAsset.name}</h2>
                <p className="text-sm text-gray-400 mt-1">Drag to rotate • Scroll to zoom • Loaded from remote server</p>
              </div>
              <div className="flex-1 relative">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p>Loading 3D model from server...</p>
                    </div>
                  </div>
                )}
                {error && selectedAsset && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center text-red-400 px-4 max-w-md">
                      <p className="text-lg mb-2">⚠️ Error</p>
                      <p className="whitespace-pre-line">{error}</p>
                      <div className="text-sm mt-4 text-gray-400 text-left">
                        <p className="font-semibold mb-2">Troubleshooting:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Check server is running on {serverUrl}</li>
                          <li>Verify CORS is enabled (use serve.py)</li>
                          <li>Check browser console (F12) for details</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={mountRef} className="w-full h-full" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <ZoomIn className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl">Select an asset to view</p>
                <p className="text-sm mt-2">Choose from your collection on the left</p>
                {allAssetFiles.length > 0 && (
                  <button
                    onClick={handleShuffle}
                    className="mt-6 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Get New Random Selection
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
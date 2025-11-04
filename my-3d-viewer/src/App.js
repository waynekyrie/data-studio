import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { Camera, Grid3x3, ZoomIn, LogOut, RefreshCw } from 'lucide-react';

export default function AssetViewer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
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
    return selected.map(filename => ({
      name: filename.replace('.obj', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      path: `${filename}`
    }));
  };

  // Load the file list from filelist.txt
  useEffect(() => {
    const loadFileList = async () => {
      setLoadingList(true);
      try {
        const response = await fetch('/assets/filelist.txt');
        if (!response.ok) {
          throw new Error('Could not load filelist.txt');
        }
        const text = await response.text();
        const files = text
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && line.endsWith('.obj'));
        
        setAllAssetFiles(files);
        setLoadingList(false);
      } catch (err) {
        console.error('Error loading file list:', err);
        setError('Failed to load file list. Make sure public/assets/filelist.txt exists.');
        setLoadingList(false);
      }
    };

    loadFileList();
  }, []);

  // Sample assets when user logs in
  useEffect(() => {
    if (isLoggedIn && allAssetFiles.length > 0 && assets.length === 0) {
      const sampledAssets = sampleAssets(allAssetFiles, SAMPLE_SIZE);
      setAssets(sampledAssets);
    }
  }, [isLoggedIn, allAssetFiles, assets.length]);

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
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Load OBJ file
    const loader = new OBJLoader();
    let loadedObject = null;

    loader.load(
      selectedAsset.path,
      (object) => {
        // Center and scale the object
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        
        object.scale.set(scale, scale, scale);
        object.position.sub(center.multiplyScalar(scale));
        
        // Apply material to all meshes
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x3b82f6,
              metalness: 0.3,
              roughness: 0.5,
            });
          }
        });
        
        scene.add(object);
        loadedObject = object;
        setLoading(false);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log(`Loading: ${percentComplete.toFixed(2)}%`);
        }
      },
      (error) => {
        console.error('Error loading OBJ:', error);
        setError(`Failed to load "${selectedAsset.name}". Make sure the file exists in public/assets/`);
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

    // Mouse controls for rotation
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

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
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
    if (email) {
      setIsLoggedIn(true);
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
          <p>Loading file list...</p>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">3D Asset Studio</h1>
            <p className="text-gray-600">Sign in to explore your 3D collection</p>
            {allAssetFiles.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {allAssetFiles.length} models available • Showing {SAMPLE_SIZE} at a time
              </p>
            )}
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
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
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
            <h1 className="text-xl font-bold">3D Asset Studio</h1>
            <div className="text-xs text-gray-400">
              {allAssetFiles.length} total • {assets.length} shown
            </div>
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
              onClick={() => setIsLoggedIn(false)}
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
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs opacity-75 mt-1 truncate">{asset.path}</div>
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
                <p className="text-sm text-gray-400 mt-1">Drag to rotate • {selectedAsset.path}</p>
              </div>
              <div className="flex-1 relative">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p>Loading 3D model...</p>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center text-red-400 px-4">
                      <p className="text-lg mb-2">⚠️ Error</p>
                      <p>{error}</p>
                      <p className="text-sm mt-4 text-gray-400">
                        Check the browser console for more details
                      </p>
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
                <button
                  onClick={handleShuffle}
                  className="mt-6 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Get New Random Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
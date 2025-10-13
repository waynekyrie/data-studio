import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Camera, Grid3x3, ZoomIn, LogOut } from 'lucide-react';

export default function AssetViewer() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  const assetFiles = [
    'chair.obj',
    'table.obj',
    'lamp.obj',
    'vase.obj',
    'sculpture.obj',
    'bottle.obj'
  ];

  useEffect(() => {
    if (isLoggedIn && assets.length === 0) {
      const loadedAssets = assetFiles.map(file => ({
        name: file.replace('.obj', ''),
        path: `/home/rui/assets/${file}`,
        thumbnail: null
      }));
      setAssets(loadedAssets);
    }
  }, [isLoggedIn, assets.length]);

  useEffect(() => {
    if (!selectedAsset || !mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.5,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      mesh.rotation.x += 0.005;
      mesh.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [selectedAsset]);

  const handleLogin = () => {
    if (email) {
      setIsLoggedIn(true);
    }
  };

  const handleAssetClick = async (asset) => {
    setLoading(true);
    setTimeout(() => {
      setSelectedAsset(asset);
      setLoading(false);
    }, 500);
  };

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
          </div>
          <button
            onClick={() => setIsLoggedIn(false)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              Your Assets ({assets.length})
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
                  <div className="text-sm opacity-75 mt-1 truncate">{asset.path}</div>
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
                <p className="text-sm text-gray-400 mt-1">{selectedAsset.path}</p>
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
                <div ref={mountRef} className="w-full h-full" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <ZoomIn className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl">Select an asset to view</p>
                <p className="text-sm mt-2">Choose from your collection on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
# data-studio
```
npx create-react-app my-3d-viewer
cd my-3d-viewer
npm install three lucide-react
npm uninstall tailwindcss
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
npm run dev
npm start

# On server
cd /data/lego/
./server.py 8000

# On host: create tunnel
ssh -L 8000:localhost:8000 lego@icl-titan.lan.cmu.edu


# Make the web public on local network
npm start -- --host 0.0.0.0



# When done
npm run clean

```
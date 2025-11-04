import glob
import os

folders = glob.glob("/home/ruixuan/03001627/*")
file_list = []
for folder in folders:
    if(os.path.isdir(folder)):
        fname = folder + "/models/model_normalized.obj"    
        file_list.append("/data" + fname[13:])

with open("public/assets/filelist.txt", "w") as f:
    for item in file_list:
        f.write("%s\n" % item)
f.close()
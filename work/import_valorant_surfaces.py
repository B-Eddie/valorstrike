from import_valorant import *
BASE_SRC='https://raw.githubusercontent.com/Shreshth1x/ValorantBrowser/main/public/model/source-textures/'
FILES={'wall':'Plaster_M0_OldWorn_DF.png','tile':'Stone_M2_DF.png','cobble':'Stone_M2_DF.png','wood':'WoodBox_0_M0_A_DF.png','metal':'Metal_M0_DF.png','roof':'Terracotta_M0_RoofTileTint_DF.png'}
folder=OUT/'surfaces';folder.mkdir(exist_ok=True)
for key,name in FILES.items():
 im=Image.open(io.BytesIO(fetch(BASE_SRC+name)));im.thumbnail((512,512));im.convert('RGB').save(folder/(key+'.jpg'),quality=90);print(key)

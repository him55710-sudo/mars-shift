import json,hashlib,unittest
import numpy as np
from pathlib import Path
from prepare_display_support_v14 import support_grid
class DisplaySupportTests(unittest.TestCase):
 def test_linear_plane_and_bounded_gap(self):
  rr,cc=np.indices((30,30));z=.05*cc+.03*rr;z[10:14,10:14]=np.nan
  e={'grid':{'width':30,'height':30,'cellSize':1,'origin':[0,0]},'elevation':z.ravel().tolist()}
  points,faces,meta=support_grid(e,stride=1,max_gap=3)
  expected=.05*(points[:,0]-.5)+.03*(points[:,2]-.5)-.04
  np.testing.assert_allclose(points[:,1],expected,atol=1e-6)
  self.assertEqual(meta['interpolatedSamples'],16);self.assertGreater(len(faces),0)
 def test_large_hole_not_bridged(self):
  z=np.zeros((30,30));z[5:25,5:25]=np.nan;e={'grid':{'width':30,'height':30,'cellSize':1,'origin':[0,0]},'elevation':z.ravel().tolist()}
  _,faces,_=support_grid(e,stride=1,max_gap=2)
  self.assertNotIn(15*30+15,faces.ravel())
 def test_original_navigation_and_source_identity(self):
  root=Path(__file__).resolve().parents[1];p=root/'public/data/drive1004';meta=json.loads((p/'display-v14/manifest.json').read_text())
  self.assertEqual(hashlib.sha256((p/'navigation-grid.json').read_bytes()).hexdigest(),meta['navigationGridSha256'])
  self.assertEqual(meta['kind'],'DISPLAY_ONLY_INTERPOLATED_DEPTH');self.assertEqual(meta['maximumDistanceToHeightSampleMetres'],3)
  self.assertEqual(hashlib.sha256((p/'display-v14/photo-support.glb').read_bytes()).hexdigest(),meta['sha256'])
if __name__=='__main__':unittest.main()

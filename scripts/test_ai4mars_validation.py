import unittest
import numpy as np
from evaluate_ai4mars import counts,metrics,features,route_audit,group,image_name

class SandValidationTests(unittest.TestCase):
    def test_exact_false_positive_and_miss_accounting(self):
        y=np.array([True,True,False,False]);p=np.array([True,False,True,False])
        self.assertEqual(counts(y,p),[1,1,1,1]);m=metrics(counts(y,p))
        self.assertEqual(m['precision'],.5);self.assertEqual(m['recall'],.5)
        self.assertEqual(m['falsePositiveRate'],.5);self.assertEqual(m['missRate'],.5)
        self.assertIsNone(metrics([0,0,3,0])['recall'])
    def test_features_depend_only_on_image_and_preserve_alignment(self):
        a=np.full((64,64),.25,dtype=np.float32);f=features(a)
        self.assertEqual(f.shape,(64,64,13));self.assertTrue(np.isfinite(f).all())
        np.testing.assert_allclose(f[:,:,0],a);np.testing.assert_allclose(f[:,:,2],0,atol=1e-6)
    def test_image_routes_are_audited_against_labels_not_optimized_with_them(self):
        y=np.zeros((9,9),dtype=np.uint8);y[4,:]=2;s=np.zeros((9,9))
        r=route_audit(y,s,.5)
        self.assertGreater(r['predicted']['expertSandCells'],0)
        self.assertIsNone(r['expertReference'])
        s[4,:]=1;r=route_audit(y,s,.5);self.assertIsNone(r['predicted'])
    def test_unknown_coverage_is_blocked_and_no_ground_scale_is_invented(self):
        y=np.zeros((9,9),dtype=np.uint8);y[4,:]=255;r=route_audit(y,np.zeros((9,9)),.5)
        self.assertIsNone(r['baseline']);self.assertIn('no ground metres',r['coordinateSystem'])
    def test_merged_label_names_and_stereo_grouping(self):
        a='NLA_409036068EDR_F0051606NCAM00348M1_merged.png';b='NRA_409036069EDR_F0051606NCAM00348M1.JPG'
        self.assertEqual(group(a),group(b));self.assertNotIn('_merged',image_name(a))

if __name__=='__main__':unittest.main()

# puzzle_definitions.py

import math

from puzzle_generator import PuzzleDefinitionBase

class RubiksCube(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        from math3d_triangle_mesh import TriangleMesh
        from math3d_vector import Vector
        from math3d_transform import AffineTransform
        from puzzle_generator import GeneratorMesh
        
        l_cut_disk = TriangleMesh.make_disk(Vector(-1.0 / 3.0, 0.0, 0.0), Vector(1.0, 0.0, 0.0), 4.0, 4)
        r_cut_disk = TriangleMesh.make_disk(Vector(1.0 / 3.0, 0.0, 0.0), Vector(-1.0, 0.0, 0.0), 4.0, 4)
        d_cut_disk = TriangleMesh.make_disk(Vector(0.0, -1.0 / 3.0, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4)
        u_cut_disk = TriangleMesh.make_disk(Vector(0.0, 1.0 / 3.0, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4)
        b_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, -1.0 / 3.0), Vector(0.0, 0.0, 1.0), 4.0, 4)
        f_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, 1.0 / 3.0), Vector(0.0, 0.0, -1.0), 4.0, 4)
        
        l_cut_disk = GeneratorMesh(mesh=l_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(-1.0, 0.0, 0.0), math.pi / 2.0))
        r_cut_disk = GeneratorMesh(mesh=r_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), math.pi / 2.0))
        d_cut_disk = GeneratorMesh(mesh=d_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, -1.0, 0.0), math.pi / 2.0))
        u_cut_disk = GeneratorMesh(mesh=u_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 1.0, 0.0), math.pi / 2.0))
        b_cut_disk = GeneratorMesh(mesh=b_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 0.0, -1.0), math.pi / 2.0))
        f_cut_disk = GeneratorMesh(mesh=f_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 0.0, 1.0), math.pi / 2.0))
        
        return [l_cut_disk, r_cut_disk, d_cut_disk, u_cut_disk, b_cut_disk, f_cut_disk]
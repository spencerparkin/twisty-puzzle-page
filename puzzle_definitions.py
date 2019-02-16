# puzzle_definitions.py

import math

from puzzle_generator import PuzzleDefinitionBase
from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_vector import Vector
from math3d_transform import AffineTransform
from math3d_sphere import Sphere
from puzzle_generator import GeneratorMesh

class RubiksCube(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):

        l_cut_disk = TriangleMesh.make_disk(Vector(-1.0 / 3.0, 0.0, 0.0), Vector(1.0, 0.0, 0.0), 4.0, 4)
        r_cut_disk = TriangleMesh.make_disk(Vector(1.0 / 3.0, 0.0, 0.0), Vector(-1.0, 0.0, 0.0), 4.0, 4)
        d_cut_disk = TriangleMesh.make_disk(Vector(0.0, -1.0 / 3.0, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4)
        u_cut_disk = TriangleMesh.make_disk(Vector(0.0, 1.0 / 3.0, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4)
        b_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, -1.0 / 3.0), Vector(0.0, 0.0, 1.0), 4.0, 4)
        f_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, 1.0 / 3.0), Vector(0.0, 0.0, -1.0), 4.0, 4)
        
        l_cut_disk = GeneratorMesh(mesh=l_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(-1.0, 0.0, 0.0), math.pi / 2.0), pick_point=Vector(1.0, 0.0, 0.0))
        r_cut_disk = GeneratorMesh(mesh=r_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), math.pi / 2.0), pick_point=Vector(-1.0, 0.0, 0.0))
        d_cut_disk = GeneratorMesh(mesh=d_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, -1.0, 0.0), math.pi / 2.0), pick_point=Vector(0.0, 1.0, 0.0))
        u_cut_disk = GeneratorMesh(mesh=u_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 1.0, 0.0), math.pi / 2.0), pick_point=Vector(0.0, -1.0, 0.0))
        b_cut_disk = GeneratorMesh(mesh=b_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 0.0, -1.0), math.pi / 2.0), pick_point=Vector(0.0, 0.0, 1.0))
        f_cut_disk = GeneratorMesh(mesh=f_cut_disk, transform=AffineTransform().make_rigid_body_motion(Vector(0.0, 0.0, 1.0), math.pi / 2.0), pick_point=Vector(0.0, 0.0, -1.0))
        
        return [l_cut_disk, r_cut_disk, d_cut_disk, u_cut_disk, b_cut_disk, f_cut_disk]
    
class CurvyCopter(PuzzleDefinitionBase):
    # Note that this puzzle will require some special-case data and programming to support the unique kind of permutation offered by this puzzle.
    # Specifically, the permutation that changes the orbits of the pedal pieces.
    
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        
        radius = (Vector(math.sqrt(2.0), math.sqrt(2.0), 0.0) - Vector(0.0, 1.0, 0.0)).length()
        
        sphere_list = [
            Sphere(Vector(-math.sqrt(2.0), -math.sqrt(2.0), 0.0), radius),
            Sphere(Vector(math.sqrt(2.0), -math.sqrt(2.0), 0.0), radius),
            Sphere(Vector(-math.sqrt(2.0), math.sqrt(2.0), 0.0), radius),
            Sphere(Vector(math.sqrt(2.0), math.sqrt(2.0), 0.0), radius),
            
            Sphere(Vector(-math.sqrt(2.0), 0.0, -math.sqrt(2.0)), radius),
            Sphere(Vector(math.sqrt(2.0), 0.0, -math.sqrt(2.0)), radius),
            Sphere(Vector(-math.sqrt(2.0), 0.0, math.sqrt(2.0)), radius),
            Sphere(Vector(math.sqrt(2.0), 0.0, math.sqrt(2.0)), radius),
            
            Sphere(Vector(0.0, -math.sqrt(2.0), -math.sqrt(2.0)), radius),
            Sphere(Vector(0.0, math.sqrt(2.0), -math.sqrt(2.0)), radius),
            Sphere(Vector(0.0, -math.sqrt(2.0), math.sqrt(2.0)), radius),
            Sphere(Vector(0.0, math.sqrt(2.0), math.sqrt(2.0)), radius)
        ]
        
        mesh_list = []
        for sphere in sphere_list:
            mesh = GeneratorMesh(mesh=sphere.make_mesh(subdivision_level=2), transform=AffineTransform().make_rigid_body_motion(sphere.center.normalized(), math.pi), pick_point=sphere.center)
            mesh_list.append(mesh)
        
        return mesh_list

class SpencerPuzzle1(PuzzleDefinitionBase):
    # This puzzle shows an example of a kind of puzzle that was not possible with previous twisty-puzzle engines I've written.
    # The new engine, however, unlike the old one, cannot handle puzzles with certain physical constraints, such as the Square-1 or Bagua.
    # On the other hand, it is not limited to only planar or spherical cuts, as shown here.  (Cuts do, however, have to be made from convex shapes.)
    
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        cube = TriangleMesh.make_polyhedron(Polyhedron.HEXAHEDRON)
        translation_list = Vector(2.0 / 3.0, 2.0 / 3.0, 2.0 / 3.0).sign_permute()
        mesh_list = [AffineTransform(translation=translation)(cube) for translation in translation_list]
        # TODO: We're not done yet.  Use GeneratorMesh class here.
        return mesh_list

class SpencerPuzzle2(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
        
    def make_generator_mesh_list(self):
        pass
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
        
        l_cut_disk = GeneratorMesh(mesh=l_cut_disk, axis=Vector(-1.0, 0.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(-1.0, 0.0, 0.0))
        r_cut_disk = GeneratorMesh(mesh=r_cut_disk, axis=Vector(1.0, 0.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(1.0, 0.0, 0.0))
        d_cut_disk = GeneratorMesh(mesh=d_cut_disk, axis=Vector(0.0, -1.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(0.0, -1.0, 0.0))
        u_cut_disk = GeneratorMesh(mesh=u_cut_disk, axis=Vector(0.0, 1.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 1.0, 0.0))
        b_cut_disk = GeneratorMesh(mesh=b_cut_disk, axis=Vector(0.0, 0.0, -1.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 0.0, -1.0))
        f_cut_disk = GeneratorMesh(mesh=f_cut_disk, axis=Vector(0.0, 0.0, 1.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 0.0, 1.0))
        
        return [l_cut_disk, r_cut_disk, d_cut_disk, u_cut_disk, b_cut_disk, f_cut_disk]
    
class CurvyCopter(PuzzleDefinitionBase):
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
            mesh = GeneratorMesh(mesh=sphere.make_mesh(subdivision_level=2), axis=sphere.center.normalized(), angle=math.pi, pick_point=sphere.center.resized(math.sqrt(2.0)))
            mesh_list.append(mesh)
        
        return mesh_list

    def annotate_puzzle_data(self, puzzle_data):

        axis_list = [
            Vector(-1.0, 0.0, 0.0),
            Vector(1.0, 0.0, 0.0),
            Vector(0.0, -1.0, 0.0),
            Vector(0.0, 1.0, 0.0),
            Vector(0.0, 0.0, -1.0),
            Vector(0.0, 0.0, 1.0)
        ]

        generator_mesh_list = puzzle_data['generator_mesh_list']

        for i in range(len(generator_mesh_list)):
            mesh_data = generator_mesh_list[i]
            generator_axis = Vector().from_dict(mesh_data['axis'])

            adjacent_axis_list = []
            for axis in axis_list:
                if axis.angle_between(generator_axis) < math.pi / 3.0:
                    adjacent_axis_list.append(axis)
            assert(len(adjacent_axis_list) == 2)

            special_case_data = {}

            gen_axis_a = generator_axis.rotated(adjacent_axis_list[0], math.pi / 2.0)
            gen_axis_b = generator_axis.rotated(adjacent_axis_list[1], math.pi / 2.0)

            special_case_data['special_move_a'] = {
                'generator_mesh_a': self._find_axis(generator_mesh_list, gen_axis_a),
                'generator_mesh_b': self._find_axis(generator_mesh_list, gen_axis_b)
            }

            gen_axis_a = generator_axis.rotated(adjacent_axis_list[0], -math.pi / 2.0)
            gen_axis_b = generator_axis.rotated(adjacent_axis_list[1], -math.pi / 2.0)

            special_case_data['special_move_b'] = {
                'generator_mesh_a': self._find_axis(generator_mesh_list, gen_axis_a),
                'generator_mesh_b': self._find_axis(generator_mesh_list, gen_axis_b)
            }

            mesh_data['special_case_data'] = special_case_data

    def _find_axis(self, generator_mesh_list, axis, eps=1e-7):
        for i, mesh_data in enumerate(generator_mesh_list):
            if (Vector().from_dict(mesh_data['axis']) - axis).length() < eps:
                return i

'''
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
'''
# puzzle_definitions.py

import math

from puzzle_generator import PuzzleDefinitionBase
from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_vector import Vector
from math3d_transform import AffineTransform, LinearTransform
from math3d_sphere import Sphere
from math3d_point_cloud import PointCloud
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

class FisherCube(RubiksCube):
    def __init__(self):
        super().__init__()

    def make_generator_mesh_list(self):
        mesh_list = super().make_generator_mesh_list()
        transform = LinearTransform().make_rotation(Vector(0.0, 1.0, 0.), math.pi / 4.0)
        mesh_list = transform(mesh_list)
        for mesh in mesh_list:
            mesh.axis = transform(mesh.axis)
            mesh.pick_point = transform(mesh.pick_point)
        return mesh_list

class FusedCube(RubiksCube):
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        mesh_list = super().make_generator_mesh_list()
        del mesh_list[4]
        del mesh_list[2]
        del mesh_list[0]
        return mesh_list

    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):
        r_cut_disk = generator_mesh_list[0]
        u_cut_disk = generator_mesh_list[1]
        f_cut_disk = generator_mesh_list[2]
        
        if cut_pass < 3:
            self.apply_generator(mesh_list, r_cut_disk)
        elif cut_pass == 3:
            self.apply_generator(mesh_list, r_cut_disk)
            self.apply_generator(mesh_list, u_cut_disk)
        elif 3 < cut_pass < 6:
            self.apply_generator(mesh_list, u_cut_disk)
        elif cut_pass == 6:
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, f_cut_disk)
        elif 6 < cut_pass < 9:
            self.apply_generator(mesh_list, f_cut_disk)
        elif cut_pass == 9:
            self.apply_generator(mesh_list, f_cut_disk)
            return False
        
        return True

class CopterBase(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()

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

        count = 12 #len(generator_mesh_list)
        for i in range(count):
            mesh_data = generator_mesh_list[i]
            generator_axis = Vector().from_dict(mesh_data['axis'])

            adjacent_axis_list = []
            for axis in axis_list:
                if math.fabs(axis.angle_between(generator_axis) - math.pi / 4.0) < 1e-5:
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

class CurvyCopter(CopterBase):
    def __init__(self):
        super().__init__()
    
    def calc_sphere_radius(self):
        return (Vector(math.sqrt(2.0), math.sqrt(2.0), 0.0) - Vector(0.0, 1.0, 0.0)).length()
    
    def make_generator_mesh_list(self):
        radius = self.calc_sphere_radius()

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

class CurvyCopterPlus(CurvyCopter):
    def __init__(self):
        super().__init__()
    
    def calc_sphere_radius(self):
        return (Vector(math.sqrt(2.0), math.sqrt(2.0), 0.0) - Vector(-0.2, 1.0, 0.0)).length()

class HelicopterCube(CopterBase):
    def __init__(self):
        super().__init__()

    def make_generator_mesh_list(self):
        point_list = [point for point in Vector(0.5, 0.5, 0.0).sign_permute(flip_z=False)]
        point_list += [point for point in Vector(0.5, 0.0, 0.5).sign_permute(flip_y=False)]
        point_list += [point for point in Vector(0.0, 0.5, 0.5).sign_permute(flip_x=False)]

        mesh_list = []
        for point in point_list:
            normal = point.normalized()
            disk = TriangleMesh.make_disk(point, -normal, 4.0, 4)
            mesh = GeneratorMesh(mesh=disk, axis=normal, angle=math.pi, pick_point=point.resized(math.sqrt(2.0)))
            mesh_list.append(mesh)

        return mesh_list

class FlowerCopter(CurvyCopter):
    def __init__(self):
        super().__init__()

    def make_generator_mesh_list(self):
        mesh_list = super().make_generator_mesh_list()
        
        radius = math.sqrt(2.0)
        point_list = [point for point in Vector(1.0, 1.0, 1.0).sign_permute()]
        for point in point_list:
            sphere = Sphere(point, radius)
            mesh = GeneratorMesh(mesh=sphere.make_mesh(subdivision_level=2), axis=point.normalized(), angle=2.0 * math.pi / 3.0, pick_point=point)
            mesh_list.append(mesh)
        
        return mesh_list

class Megaminx(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def make_initial_mesh_list(self):
        mesh = TriangleMesh().make_polyhedron(Polyhedron.DODECAHEDRON)
        face_mesh_list, self.plane_list = self.make_face_meshes(mesh)
        return face_mesh_list

    def make_generator_mesh_list(self):
        mesh_list = []
        for plane in self.plane_list:
            disk = TriangleMesh.make_disk(plane.center.scaled(0.7), -plane.unit_normal, 4.0, 4)
            mesh = GeneratorMesh(mesh=disk, axis=plane.unit_normal, angle=2.0 * math.pi / 5.0, pick_point=plane.center)
            mesh_list.append(mesh)
        return mesh_list

class DinoCube(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()

    def make_generator_mesh_list(self):
        length = ((Vector(1.0, -1.0, 1.0) + Vector(1.0, 1.0, -1.0) + Vector(-1.0, 1.0, 1.0)) / 3.0).length()
        mesh_list = []
        for vector in Vector(1.0, 1.0, 1.0).sign_permute():
            mesh = GeneratorMesh(mesh=TriangleMesh.make_disk(vector.resized(length), -vector.normalized(), 4.0, 4), axis=vector.normalized(), angle=2.0 * math.pi / 3.0, pick_point=vector)
            mesh_list.append(mesh)
        return mesh_list

class FlowerRexCube(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        mesh_list = []
        length = 3.0
        radius = (Vector(1.0, 1.0, 1.0).resized(length) - Vector(-1.0, 1.0, 1.0)).length()
        for vector in Vector(1.0, 1.0, 1.0).sign_permute():
            mesh = GeneratorMesh(mesh=Sphere(vector.resized(length), radius).make_mesh(subdivision_level=2), axis=vector.normalized(), angle=2.0 * math.pi / 3.0, pick_point=vector)
            mesh_list.append(mesh)
        return mesh_list
    
    def min_mesh_area(self):
        return 0.05

class Skewb(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def make_generator_mesh_list(self):
        mesh_list = []
        for vector in Vector(1.0, 1.0, 1.0).sign_permute():
            mesh = GeneratorMesh(mesh=TriangleMesh.make_disk(Vector(0.0, 0.0, 0.0), -vector.normalized(), 4.0, 4), axis=vector.normalized(), angle=2.0 * math.pi / 3.0, pick_point=vector)
            mesh_list.append(mesh)
        return mesh_list

class SquareOne(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def bandages(self):
        return True
    
    def make_generator_mesh_list(self):
        mesh_list = []
        
        angle = math.pi + math.pi / 12.0
        normal = Vector(math.cos(angle), 0.0, math.sin(angle))
        mesh = GeneratorMesh(mesh=TriangleMesh.make_disk(Vector(0.0, 0.0, 0.0), normal, 4.0, 4), axis=-normal, angle=math.pi, pick_point=normal.resized(-2.0))
        mesh_list.append(mesh)
        
        mesh = GeneratorMesh(mesh=TriangleMesh.make_disk(Vector(0.0, 0.2, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4), axis=Vector(0.0, 1.0, 0.0), angle=math.pi / 6.0, pick_point=Vector(0.0, 1.0, 0.0))
        mesh_list.append(mesh)
        
        mesh = GeneratorMesh(mesh=TriangleMesh.make_disk(Vector(0.0, -0.2, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4), axis=Vector(0.0, -1.0, 0.0), angle=math.pi / 6.0, pick_point=Vector(0.0, -1.0, 0.0))
        mesh_list.append(mesh)
        
        return mesh_list

    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):
        u_cut_disk = generator_mesh_list[1]
        d_cut_disk = generator_mesh_list[2]
        
        if cut_pass == 0:
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
            return True
        elif cut_pass == 1:
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
            return True
        elif cut_pass == 2:
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
            return True

        for i in range(8):
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
        return False

class Bagua(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
    
    def bandages(self):
        return True
    
    def make_generator_mesh_list(self):

        l_cut_disk = TriangleMesh.make_disk(Vector(-1.0 / 2.0, 0.0, 0.0), Vector(1.0, 0.0, 0.0), 4.0, 4)
        r_cut_disk = TriangleMesh.make_disk(Vector(1.0 / 2.0, 0.0, 0.0), Vector(-1.0, 0.0, 0.0), 4.0, 4)
        d_cut_disk = TriangleMesh.make_disk(Vector(0.0, -1.0 / 2.0, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4)
        u_cut_disk = TriangleMesh.make_disk(Vector(0.0, 1.0 / 2.0, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4)
        b_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, -1.0 / 2.0), Vector(0.0, 0.0, 1.0), 4.0, 4)
        f_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, 1.0 / 2.0), Vector(0.0, 0.0, -1.0), 4.0, 4)

        l_cut_disk = GeneratorMesh(mesh=l_cut_disk, axis=Vector(-1.0, 0.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(-1.0, 0.0, 0.0))
        r_cut_disk = GeneratorMesh(mesh=r_cut_disk, axis=Vector(1.0, 0.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(1.0, 0.0, 0.0))
        d_cut_disk = GeneratorMesh(mesh=d_cut_disk, axis=Vector(0.0, -1.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(0.0, -1.0, 0.0))
        u_cut_disk = GeneratorMesh(mesh=u_cut_disk, axis=Vector(0.0, 1.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 1.0, 0.0))
        b_cut_disk = GeneratorMesh(mesh=b_cut_disk, axis=Vector(0.0, 0.0, -1.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 0.0, -1.0))
        f_cut_disk = GeneratorMesh(mesh=f_cut_disk, axis=Vector(0.0, 0.0, 1.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 0.0, 1.0))

        return [l_cut_disk, r_cut_disk, d_cut_disk, u_cut_disk, b_cut_disk, f_cut_disk]

    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):

        l_cut_disk = generator_mesh_list[0]
        r_cut_disk = generator_mesh_list[1]
        d_cut_disk = generator_mesh_list[2]
        u_cut_disk = generator_mesh_list[3]
        b_cut_disk = generator_mesh_list[4]
        f_cut_disk = generator_mesh_list[5]
        
        if cut_pass == 0:
            self.apply_generator(mesh_list, l_cut_disk)
            self.apply_generator(mesh_list, r_cut_disk, inverse=True)
            return True
        elif cut_pass == 1:
            self.apply_generator(mesh_list, l_cut_disk, inverse=True)
            self.apply_generator(mesh_list, r_cut_disk)
            self.apply_generator(mesh_list, u_cut_disk)
            self.apply_generator(mesh_list, d_cut_disk, inverse=True)
            return True
        elif cut_pass == 2:
            self.apply_generator(mesh_list, u_cut_disk, inverse=True)
            self.apply_generator(mesh_list, d_cut_disk)
            self.apply_generator(mesh_list, b_cut_disk)
            self.apply_generator(mesh_list, f_cut_disk, inverse=True)
            return True

        self.apply_generator(mesh_list, b_cut_disk, inverse=True)
        self.apply_generator(mesh_list, f_cut_disk)
        return False

class PentacleCube(RubiksCube):
    def __init__(self):
        super().__init__()
    
    def bandages(self):
        return True
    
    def make_generator_mesh_list(self):
        mesh_list = super().make_generator_mesh_list()
        
        vector_list = [
            Vector(-1.0, 0.0, 0.0),
            Vector(1.0, 0.0, 0.0),
            Vector(0.0, -1.0, 0.0),
            Vector(0.0, 1.0, 0.0),
            Vector(0.0, 0.0, -1.0),
            Vector(0.0, 0.0, 1.0)
        ]
        
        for vector in vector_list:
            mesh = GeneratorMesh(mesh=Sphere(vector, 1.0).make_mesh(subdivision_level=2), axis=vector, angle=math.pi / 10.0, pick_point=vector.resized(1.5))
            mesh_list.append(mesh)
        
        return mesh_list

    def can_apply_cutmesh_for_pass(self, i, cut_mesh, cut_pass, generator_mesh_list):
        if cut_pass == 0 and i >= 6:
            return True
        
        if cut_pass == 1 and i == 0: # left
            return True
        if cut_pass == 2 and i == 3: # up
            return True
        if cut_pass == 3 and i == 1: # right
            return True
        if cut_pass == 4 and i == 2: # down
            return True
        if cut_pass == 5 and i == 0: # left
            return True
        if cut_pass == 6 and i == 5: # forward
            return True
        if cut_pass == 7 and i == 4: # back
            return True
        if cut_pass == 8 and i == 5: # forward
            return True
        
        return False

    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):
        l_cut_circle = generator_mesh_list[6]
        r_cut_circle = generator_mesh_list[7]
        d_cut_circle = generator_mesh_list[8]
        u_cut_circle = generator_mesh_list[9]
        b_cut_circle = generator_mesh_list[10]
        f_cut_circle = generator_mesh_list[11]
        
        if cut_pass == 0:
            pass
        
        if cut_pass == 1 or cut_pass == 2 or cut_pass == 3 or cut_pass == 4:
            self.apply_generator(mesh_list, f_cut_circle)
            self.apply_generator(mesh_list, b_cut_circle, inverse=True)
            self.apply_generator(mesh_list, u_cut_circle, inverse=True)
            self.apply_generator(mesh_list, d_cut_circle)
            self.apply_generator(mesh_list, l_cut_circle)
            self.apply_generator(mesh_list, r_cut_circle, inverse=True)
        
        if cut_pass == 5:
            for i in range(6):
                self.apply_generator(mesh_list, l_cut_circle)
                self.apply_generator(mesh_list, r_cut_circle, inverse=True)
            for i in range(3):
                self.apply_generator(mesh_list, u_cut_circle)
                self.apply_generator(mesh_list, d_cut_circle, inverse=True)
                
        if cut_pass == 6 or cut_pass == 7:
            for i in range(2):
                self.apply_generator(mesh_list, l_cut_circle)
                self.apply_generator(mesh_list, r_cut_circle, inverse=True)
            for i in range(2):
                self.apply_generator(mesh_list, u_cut_circle, inverse=True)
                self.apply_generator(mesh_list, d_cut_circle)
                
        return True if cut_pass < 8 else False

    def can_shrink_mesh(self, mesh):
        for point in Vector(1.0, 1.0, 1.0).sign_permute():
            if any([(vertex - point).length() < 1e-4 for vertex in mesh.vertex_list]):
                return False
        return True

    def shrink_scale(self):
        return 0.90

    def shrink_mesh(self, mesh, center=None):
        from math3d_point_cloud import PointCloud
        for point in Vector(1.0, 1.0, 1.0).sign_permute():
            if any([(vertex - point).length() < 1e-4 for vertex in mesh.vertex_list]):
                point_cloud = PointCloud(mesh.vertex_list)
                for i in range(30):
                    point_cloud.point_list.append(point)
                center = point_cloud.calc_center()
                break
        super().shrink_mesh(mesh, center=center)
    
    def min_mesh_area(self):
        return 0.05

class MixupCube(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()

    def can_apply_cutmesh_for_pass(self, i, cut_mesh, cut_pass, generator_mesh_list):
        return True if i < 6 else False
    
    def make_generator_mesh_list(self):

        q = math.tan(math.pi / 8.0)

        l_cut_disk = TriangleMesh.make_disk(Vector(-q, 0.0, 0.0), Vector(1.0, 0.0, 0.0), 4.0, 4)
        r_cut_disk = TriangleMesh.make_disk(Vector(q, 0.0, 0.0), Vector(-1.0, 0.0, 0.0), 4.0, 4)
        d_cut_disk = TriangleMesh.make_disk(Vector(0.0, -q, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4)
        u_cut_disk = TriangleMesh.make_disk(Vector(0.0, q, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4)
        b_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, -q), Vector(0.0, 0.0, 1.0), 4.0, 4)
        f_cut_disk = TriangleMesh.make_disk(Vector(0.0, 0.0, q), Vector(0.0, 0.0, -1.0), 4.0, 4)

        l_cut_disk = GeneratorMesh(mesh=l_cut_disk, axis=Vector(-1.0, 0.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(-1.0, 0.0, 0.0))
        r_cut_disk = GeneratorMesh(mesh=r_cut_disk, axis=Vector(1.0, 0.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(1.0, 0.0, 0.0))
        d_cut_disk = GeneratorMesh(mesh=d_cut_disk, axis=Vector(0.0, -1.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(0.0, -1.0, 0.0))
        u_cut_disk = GeneratorMesh(mesh=u_cut_disk, axis=Vector(0.0, 1.0, 0.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 1.0, 0.0))
        b_cut_disk = GeneratorMesh(mesh=b_cut_disk, axis=Vector(0.0, 0.0, -1.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 0.0, -1.0))
        f_cut_disk = GeneratorMesh(mesh=f_cut_disk, axis=Vector(0.0, 0.0, 1.0), angle=math.pi / 2.0, pick_point=Vector(0.0, 0.0, 1.0))

        mesh_list = [l_cut_disk, r_cut_disk, d_cut_disk, u_cut_disk, b_cut_disk, f_cut_disk]

        center_slice = TriangleMesh.make_disk(Vector(-q, 0.0, 0.0), Vector(-1.0, 0.0, 0.0), 4.0, 4) + TriangleMesh.make_disk(Vector(q, 0.0, 0.0), Vector(1.0, 0.0, 0.0), 4.0, 4)
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(1.0, 0.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(1.5, 0.0, 0.0)))
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(-1.0, 0.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(-1.5, 0.0, 0.0)))

        center_slice = TriangleMesh.make_disk(Vector(0.0, -q, 0.0), Vector(0.0, -1.0, 0.0), 4.0, 4) + TriangleMesh.make_disk(Vector(0.0, q, 0.0), Vector(0.0, 1.0, 0.0), 4.0, 4)
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(0.0, 1.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 1.5, 0.0)))
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(0.0, -1.0, 0.0), angle=math.pi / 4.0, pick_point=Vector(0.0, -1.5, 0.0)))

        center_slice = TriangleMesh.make_disk(Vector(0.0, 0.0, -q), Vector(0.0, 0.0, -1.0), 4.0, 4) + TriangleMesh.make_disk(Vector(0.0, 0.0, q), Vector(0.0, 0.0, 1.0), 4.0, 4)
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(0.0, 0.0, 1.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 0.0, 1.5)))
        mesh_list.append(GeneratorMesh(mesh=center_slice, axis=Vector(0.0, 0.0, -1.0), angle=math.pi / 4.0, pick_point=Vector(0.0, 0.0, -1.5)))

        return mesh_list

class Dogic(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()

    def make_initial_mesh_list(self):
        self.mesh = TriangleMesh().make_polyhedron(Polyhedron.ICOSAHEDRON)
        face_mesh_list, plane_list = self.make_face_meshes(self.mesh.clone())
        return face_mesh_list

    def can_apply_cutmesh_for_pass(self, i, cut_mesh, cut_pass, generator_mesh_list):
        return False if i % 2 == 0 else True

    def make_generator_mesh_list(self):
        mesh_list = []
        for vertex in self.mesh.vertex_list:
            point_cloud = PointCloud()
            for triangle in self.mesh.yield_triangles():
                for i in range(3):
                    if triangle[i] == vertex:
                        point_cloud.add_point(triangle[i + 1])
                        point_cloud.add_point(triangle[i + 2])
                        break
            center = point_cloud.calc_center()
            normal = vertex.normalized()
            disk = TriangleMesh.make_disk(center, -normal, 4.0, 4)
            mesh_list.append(GeneratorMesh(mesh=disk, axis=normal, angle=2.0 * math.pi / 5.0, pick_point=vertex))
            disk = TriangleMesh.make_disk((center + vertex) / 2.0, -normal, 4.0, 4)
            mesh_list.append(GeneratorMesh(mesh=disk, axis=normal, angle=2.0 * math.pi / 5.0, pick_point=vertex * 1.2))
        return mesh_list

class Bubbloid4x4x5(PuzzleDefinitionBase):
    def __init__(self):
        super().__init__()
        self.a = 2.0 - math.sqrt(2.0)
        self.b = 1.0 - self.a
        self.s = (2.0 * self.a + 3.0 * self.b) / (2.0 * self.a + 2.0 * self.b)

    def make_initial_mesh_list(self):
        mesh_list = super().make_initial_mesh_list()
        scale_transform = LinearTransform().make_non_uniform_scale(1.0, self.s, 1.0)
        mesh_list = [scale_transform(mesh) for mesh in mesh_list]
        return mesh_list

    def make_generator_mesh_list(self):
        scale_transform = LinearTransform().make_non_uniform_scale(1.0, self.s, 1.0)
        radius = self.a + 2.0 * self.b
        mesh_list = []
        for vector in Vector(1.0, 1.0, 1.0).sign_permute():
            center = scale_transform(vector)
            mesh = GeneratorMesh(mesh=Sphere(center, radius).make_mesh(subdivision_level=1), axis=vector.normalized(), angle=2.0 * math.pi / 3.0, center=center, pick_point=center)
            mesh_list.append(mesh)
        return mesh_list

    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):

        # TODO: The top and bottom get fully cut, but not the middle.

        if cut_pass == 0 or cut_pass == 1 or cut_pass == 2:
            self.apply_generator(mesh_list, generator_mesh_list[0])
        if cut_pass == 2 or cut_pass == 3 or cut_pass == 4:
            self.apply_generator(mesh_list, generator_mesh_list[1])
        if cut_pass == 4 or cut_pass == 5 or cut_pass == 6:
            self.apply_generator(mesh_list, generator_mesh_list[2])
        if cut_pass == 6 or cut_pass == 7 or cut_pass == 8:
            self.apply_generator(mesh_list, generator_mesh_list[3])
        if cut_pass == 8 or cut_pass == 9 or cut_pass == 10:
            self.apply_generator(mesh_list, generator_mesh_list[4])
        if cut_pass == 10 or cut_pass == 11 or cut_pass == 12:
            self.apply_generator(mesh_list, generator_mesh_list[5])
        if cut_pass == 12 or cut_pass == 13 or cut_pass == 14:
            self.apply_generator(mesh_list, generator_mesh_list[6])
        if cut_pass == 14 or cut_pass == 15 or cut_pass == 16:
            self.apply_generator(mesh_list, generator_mesh_list[7])

        return True if cut_pass < 16 else False

    def can_apply_cutmesh_for_pass(self, i, cut_mesh, cut_pass, generator_mesh_list):
        if cut_pass == 0:
            return True

        if cut_pass == 1 or cut_pass == 2:
            vector = generator_mesh_list[0].axis.resized(math.sqrt(3.0))
        elif cut_pass == 3 or cut_pass == 4:
            vector = generator_mesh_list[1].axis.resized(math.sqrt(3.0))
        elif cut_pass == 5 or cut_pass == 6:
            vector = generator_mesh_list[2].axis.resized(math.sqrt(3.0))
        elif cut_pass == 7 or cut_pass == 8:
            vector = generator_mesh_list[3].axis.resized(math.sqrt(3.0))
        elif cut_pass == 9 or cut_pass == 10:
            vector = generator_mesh_list[4].axis.resized(math.sqrt(3.0))
        elif cut_pass == 11 or cut_pass == 12:
            vector = generator_mesh_list[5].axis.resized(math.sqrt(3.0))
        elif cut_pass == 13 or cut_pass == 14:
            vector = generator_mesh_list[6].axis.resized(math.sqrt(3.0))
        elif cut_pass == 15 or cut_pass == 16:
            vector = generator_mesh_list[7].axis.resized(math.sqrt(3.0))

        distance = (vector - cut_mesh.axis.resized(math.sqrt(3.0))).length()
        if math.fabs(distance - 2.0) < 1e-5:
            return True
        return False

# TODO: Add 4x4 and 2x2.
# TODO: Add 2x2x3 and 3x3x2 and 3x3x2 with cylindrical cut.
# TODO: Add pyraminx.
# TODO: How would we do the LatchCube?  This is one of my favorite cubes, because it's so hard.
# TODO: Add Eitan's Star.
# TODO: How would we do the Worm Hole II?  Perhaps some generators would have to be dependencies of others.
# TODO: Add conjoined 3x3 Rubkiks Cubes, a concave shape.
# TODO: Add Gem series?
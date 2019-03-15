# puzzle_generator.py

import argparse
import sys
import json

sys.path.append(r'c:\dev\pyMath3d')

from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_transform import LinearTransform, AffineTransform
from math3d_vector import Vector
from math3d_side import Side
from math3d_point_cloud import PointCloud

class ColoredMesh(TriangleMesh):
    def __init__(self, mesh=None, color=None):
        super().__init__(mesh=mesh)
        self.color = color if color is not None else Vector(0.0, 0.0, 0.0)
        self.uv_list = []
        self.normal_list = []
        self.texture_number = -1

    def clone(self):
        return ColoredMesh(mesh=super().clone(), color=self.color.clone())

    def to_dict(self):
        data = super().to_dict()
        data['color'] = self.color.to_dict()
        data['uv_list'] = [uv.to_dict() for uv in self.uv_list]
        data['normal_list'] = [normal.to_dict() for normal in self.normal_list]
        data['texture_number'] = self.texture_number
        return data

    def from_dict(self, data):
        super().from_dict(data)
        self.color = Vector().from_dict(data.get('color', {}))
        self.uv_list = [Vector().from_dict(uv) for uv in data.get('uv_list', [])]
        self.normal_list = [Vector().from_dict(normal) for normal in data.get('normal_list', [])]
        self.texture_number = data.get('texture_number', -1)
        return self
    
    def render(self):
        from OpenGL.GL import glMaterialfv, GL_FRONT, GL_SPECULAR, GL_SHININESS, GL_AMBIENT, GL_DIFFUSE

        glMaterialfv(GL_FRONT, GL_SPECULAR, [1.0, 1.0, 1.0, 1.0])
        glMaterialfv(GL_FRONT, GL_SHININESS, [30.0])
        glMaterialfv(GL_FRONT, GL_AMBIENT, [self.color.x * 0.3, self.color.y * 0.3, self.color.z * 0.3, 1.0])
        glMaterialfv(GL_FRONT, GL_DIFFUSE, [self.color.x, self.color.y, self.color.z, 1.0])
        
        super().render()

    def scale(self, scale_factor, center=None):
        if center is None:
            # Hmmm...this wont' quite work for concave shapes.
            center = super().calc_center()
        for i, vertex in enumerate(self.vertex_list):
            vector = vertex - center
            vector = vector * scale_factor
            self.vertex_list[i] = center + vector

    def calc_center(self):
        # For our purposes, this doesn't have to be an interior point that best represents
        # the center of the mesh (although I wish I had a good idea of how to calculate that.)
        # It just needs to be any interior point, but one furthest from the edge, if possible.
        largest_area = 0.0
        best_triangle = None
        for triangle in self.yield_triangles():
            area = triangle.area()
            if area > largest_area:
                largest_area = area
                best_triangle = triangle
        return best_triangle.calc_center()

class GeneratorMesh(TriangleMesh):
    def __init__(self, mesh=None, center=None, axis=None, angle=None, pick_point=None):
        super().__init__(mesh=mesh)
        self.center = center if center is not None else Vector(0.0, 0.0, 0.0)
        self.axis = axis if axis is not None else Vector(0.0, 0.0, 1.0)
        self.angle = angle if angle is not None else 0.0
        self.pick_point = Vector(0.0, 0.0, 0.0) if pick_point is None else pick_point

    def clone(self):
        return GeneratorMesh(mesh=super().clone(), axis=self.axis.clone(), angle=self.angle, pick_point=self.pick_point.clone())

    def to_dict(self):
        data = super().to_dict()
        data['center'] = self.center.to_dict()
        data['axis'] = self.axis.to_dict()
        data['angle'] = self.angle
        data['pick_point'] = self.pick_point.to_dict()
        return data
    
    def from_dict(self, data):
        super().from_dict(data)
        self.center = Vector().from_dict(data.get('center', {}))
        self.axis = Vector().from_dict(data.get('axis', {}))
        self.angle = data.get('angle', 0.0)
        self.pick_point = Vector().from_dict(data.get('pick_point', {}))
        return self

    def make_plane_list(self):
        plane_list = []
        for triangle in self.yield_triangles():
            plane = triangle.calc_plane()
            plane_list.append(plane.to_dict())
        return plane_list
    
    def captures_mesh(self, mesh):
        center = mesh.calc_center()
        return True if self.side(center) == Side.BACK else False

    def transform_mesh(self, mesh, inverse=False):
        transform = AffineTransform().make_rotation(self.axis, -self.angle if not inverse else self.angle, center=self.center)
        return transform(mesh)

class PuzzleDefinitionBase(object):
    def __init__(self):
        pass
    
    def bandages(self):
        return False
    
    def make_initial_mesh_list(self):
        # Most, but not all puzzles are based on the cube with the following standard colors.
        
        cube_mesh = TriangleMesh().make_polyhedron(Polyhedron.HEXAHEDRON)
        
        l_mesh = ColoredMesh(color=Vector(0.0, 0.0, 1.0))
        r_mesh = ColoredMesh(color=Vector(0.0, 1.0, 0.0))
        d_mesh = ColoredMesh(color=Vector(1.0, 1.0, 1.0))
        u_mesh = ColoredMesh(color=Vector(1.0, 1.0, 0.0))
        b_mesh = ColoredMesh(color=Vector(1.0, 0.5, 0.0))
        f_mesh = ColoredMesh(color=Vector(1.0, 0.0, 0.0))
        
        for triangle in cube_mesh.yield_triangles():
            if all([triangle[i].x == -1.0 for i in range(3)]):
                l_mesh.add_triangle(triangle)
            elif all([triangle[i].x == 1.0 for i in range(3)]):
                r_mesh.add_triangle(triangle)
            elif all([triangle[i].y == -1.0 for i in range(3)]):
                d_mesh.add_triangle(triangle)
            elif all([triangle[i].y == 1.0 for i in range(3)]):
                u_mesh.add_triangle(triangle)
            elif all([triangle[i].z == -1.0 for i in range(3)]):
                b_mesh.add_triangle(triangle)
            elif all([triangle[i].z == 1.0 for i in range(3)]):
                f_mesh.add_triangle(triangle)
        
        return [l_mesh, r_mesh, d_mesh, u_mesh, b_mesh, f_mesh]
    
    def make_generator_mesh_list(self):
        raise Exception('Please override this method.')
    
    def min_mesh_area(self):
        return 0.001
    
    def can_apply_cutmesh_for_pass(self, i, cut_mesh, cut_pass, generator_mesh_list):
        return True

    def generate_final_mesh_list(self):
        initial_mesh_list = self.make_initial_mesh_list()
        final_mesh_list = [mesh.clone() for mesh in initial_mesh_list]
        generator_mesh_list = self.make_generator_mesh_list()
        
        cut_pass = 0
        while True:
            print('Performing cut pass %d...' % cut_pass)
            
            # Cut all the meshes against all the generator meshes.
            for i, cut_mesh in enumerate(generator_mesh_list):
                if self.can_apply_cutmesh_for_pass(i, cut_mesh, cut_pass, generator_mesh_list):
                    print('Applying cut mesh %d of %d...' % (i + 1, len(generator_mesh_list)))
                    new_mesh_list = []
                    for mesh in final_mesh_list:
                        back_mesh, front_mesh = mesh.split_against_mesh(cut_mesh)
                        if len(back_mesh.triangle_list) > 0:
                            new_mesh_list.append(ColoredMesh(mesh=back_mesh, color=mesh.color))
                        if len(front_mesh.triangle_list) > 0:
                            new_mesh_list.append(ColoredMesh(mesh=front_mesh, color=mesh.color))
                    final_mesh_list = new_mesh_list

            # Cull meshes with area below a certain threshold to eliminate some artifacting.
            i = 0
            while i < len(final_mesh_list):
                mesh = final_mesh_list[i]
                area = mesh.area()
                if area < self.min_mesh_area():
                    del final_mesh_list[i]
                else:
                    i += 1
            
            # Give the class a chance to transform the meshes for another round of cutting.
            # Before iteration completes, however, the class needs to make sure all meshes properly placed.
            if not self.transform_meshes_for_more_cutting(final_mesh_list, generator_mesh_list, cut_pass):
                break
            
            cut_pass += 1

        # This gives each face a sense that it has a border.
        for mesh in final_mesh_list:
            self.shrink_mesh(mesh)

        return final_mesh_list, initial_mesh_list, generator_mesh_list

    def shrink_mesh(self, mesh, center=None):
        mesh.scale(0.95, center=center)
    
    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):
        return False
    
    def apply_generator(self, mesh_list, generator_mesh, inverse=False):
        for i, mesh in enumerate(mesh_list):
            if generator_mesh.captures_mesh(mesh):
                mesh_list[i] = generator_mesh.transform_mesh(mesh, inverse)
    
    def generate_puzzle_file(self):
        final_mesh_list, initial_mesh_list, generator_mesh_list = self.generate_final_mesh_list()
        
        self.calculate_uvs(final_mesh_list, initial_mesh_list)
        self.calculate_normals(final_mesh_list)
        
        puzzle_data = {
            'mesh_list': [{**mesh.to_dict(), 'center': mesh.calc_center().to_dict()} for mesh in final_mesh_list],
            'generator_mesh_list': [{**mesh.to_dict(), 'plane_list': mesh.make_plane_list()} for mesh in generator_mesh_list],
            'bandages': self.bandages()
        }

        self.annotate_puzzle_data(puzzle_data)

        puzzle_path = 'puzzles/' + self.__class__.__name__ + '.json'
        with open(puzzle_path, 'w') as handle:
            json_text = json.dumps(puzzle_data, indent=4, separators=(',', ': '), sort_keys=True)
            handle.write(json_text)
        
        return puzzle_path

    def calculate_uvs(self, final_mesh_list, initial_mesh_list):
        for i, mesh in enumerate(initial_mesh_list):
            plane = PointCloud(mesh.vertex_list).fit_plane()
            if plane.center.dot(plane.unit_normal) < 0.0:
                plane.unit_normal = -plane.unit_normal
            x_axis = plane.unit_normal.perpendicular_vector().normalized()
            y_axis = plane.unit_normal.cross(x_axis)
            z_axis = plane.unit_normal.clone()
            transform = AffineTransform(x_axis=x_axis, y_axis=y_axis, z_axis=z_axis, translation=plane.center)
            inverse_transform = transform.calc_inverse()
            x_min = 1000.0
            x_max = -1000.0
            y_min = 1000.0
            y_max = -1000.0
            vertex_list = [inverse_transform(vertex) for vertex in mesh.vertex_list]
            for vertex in vertex_list:
                if vertex.x < x_min:
                    x_min = vertex.x
                if vertex.x > x_max:
                    x_max = vertex.x
                if vertex.y < y_min:
                    y_min = vertex.y
                if vertex.y > y_max:
                    y_max = vertex.y
            x_delta = x_max - x_min
            y_delta = y_max - y_min
            if x_delta > y_delta:
                delta = (x_delta - y_delta) * 0.5
                y_min -= delta
                y_max += delta
            elif x_delta < y_delta:
                delta = (y_delta - x_delta) * 0.5
                x_min -= delta
                x_max += delta
            for face_mesh in final_mesh_list:
                center = face_mesh.calc_center()
                if plane.side(center, eps=1e-4) == Side.NEITHER:
                    face_mesh.texture_number = i
                    face_mesh.uv_list = []
                    vertex_list = [inverse_transform(vertex) for vertex in face_mesh.vertex_list]
                    for vertex in vertex_list:
                        u = (vertex.x - x_min) / (x_max - x_min)
                        v = (vertex.y - y_min) / (y_max - y_min)
                        face_mesh.uv_list.append(Vector(u, v, 0.0))

    def calculate_normals(self, final_mesh_list):
        for mesh in final_mesh_list:
            mesh.normal_list = mesh.calc_vertex_normals()

    def annotate_puzzle_data(self, puzzle_data):
        pass
    
    def cull_near_degenerate_triangles(self, mesh_list, eps=0.05):
        # Cutting can mess up if there are near-degenerate triangles in the mesh, so try to remove them now.
        i = 0
        while i < len(mesh_list):
            mesh = mesh_list[i]
            mesh.reduce_vertices(eps)
            if len(mesh.triangle_list) == 0:
                del mesh_list[i]
            else:
                i += 1
    
    def make_face_meshes(self, mesh):
        face_mesh_list = []
        plane_list = []
        color_list = [
            Vector(1.0, 0.0, 0.0),
            Vector(0.0, 1.0, 0.0),
            Vector(0.0, 0.0, 1.0),
            Vector(1.0, 1.0, 0.0),
            Vector(1.0, 0.0, 1.0),
            Vector(0.0, 1.0, 1.0),
            Vector(1.0, 0.0, 0.5),
            Vector(1.0, 0.5, 0.0),
            Vector(0.0, 1.0, 0.5),
            Vector(0.5, 1.0, 0.0),
            Vector(0.0, 0.5, 1.0),
            Vector(0.5, 0.0, 1.0),
            Vector(0.5, 0.5, 0.5)
        ]
        j = 0
        
        while len(mesh.triangle_list) > 0:
            triple = mesh.triangle_list.pop(0)
            
            triangle = mesh.make_triangle(triple)
            triangle_list = [triangle]
            
            plane = triangle.calc_plane()
            plane_list.append(plane)
            
            i = 0
            while i < len(mesh.triangle_list):
                triangle = mesh.make_triangle(i)
                if all([plane.side(triangle[i]) == Side.NEITHER for i in range(3)]):
                    triangle_list.append(triangle)
                    del mesh.triangle_list[i]
                else:
                    i += 1
            
            if j < len(color_list):
                color = color_list[j]
                j += 1
            else:
                color = Vector().random()
            
            face_mesh = ColoredMesh(color=color, mesh=TriangleMesh().from_triangle_list(triangle_list))
            face_mesh_list.append(face_mesh)
            
        return face_mesh_list, plane_list

def main():
    from puzzle_definitions import RubiksCube, FisherCube, FusedCube, CurvyCopter
    from puzzle_definitions import CurvyCopterPlus, HelicopterCube, FlowerCopter
    from puzzle_definitions import Megaminx, DinoCube, FlowerRexCube, Skewb
    from puzzle_definitions import SquareOne, Bagua, PentacleCube, MixupCube
    from puzzle_definitions import Dogic, Bubbloid4x4x5, Rubiks2x2, Rubiks4x4
    from puzzle_definitions import Pyraminx, BauhiniaDodecahedron, SkewbUltimate

    puzzle_class_list = [
        RubiksCube, FisherCube, FusedCube, CurvyCopter,
        CurvyCopterPlus, HelicopterCube, FlowerCopter,
        Megaminx, DinoCube, FlowerRexCube, Skewb,
        SquareOne, Bagua, PentacleCube, MixupCube,
        Dogic, Bubbloid4x4x5, Rubiks2x2, Rubiks4x4,
        Pyraminx, BauhiniaDodecahedron, SkewbUltimate
    ]

    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument('--puzzle', help='Specify which puzzle to generate.  If not given, all are generated.', type=str)
    args = arg_parser.parse_args()

    for puzzle_class in puzzle_class_list:
        if args.puzzle is not None and args.puzzle != puzzle_class.__name__:
            continue
        print('Generating: %s' % puzzle_class.__name__)
        puzzle = puzzle_class()
        puzzle.generate_puzzle_file()
    
    print('Process complete!')

if __name__ == '__main__':
    main()
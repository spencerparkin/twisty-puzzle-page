# puzzle_generator.py

import argparse
import sys
import json
import math
import gzip
import datetime

sys.path.append(r'c:\dev\pyMath3d')

from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_transform import LinearTransform, AffineTransform
from math3d_vector import Vector
from math3d_side import Side
from math3d_point_cloud import PointCloud

class ColoredMesh(TriangleMesh):
    def __init__(self, mesh=None, color=None, alpha=1.0):
        super().__init__(mesh=mesh)
        self.color = color if color is not None else Vector(0.0, 0.0, 0.0)
        self.alpha = alpha
        self.uv_list = []
        self.normal_list = []
        self.texture_number = -1
        self.border_loop = []

    def clone(self):
        return ColoredMesh(mesh=super().clone(), color=self.color.clone(), alpha=self.alpha)

    def to_dict(self):
        data = super().to_dict()
        data['color'] = self.color.to_dict()
        data['alpha'] = self.alpha
        data['uv_list'] = [uv.to_dict() for uv in self.uv_list]
        data['normal_list'] = [normal.to_dict() for normal in self.normal_list]
        data['texture_number'] = self.texture_number
        data['border_loop'] = self.border_loop
        return data

    def from_dict(self, data):
        super().from_dict(data)
        self.color = Vector().from_dict(data.get('color', {}))
        self.alpha = data.get('alpha', 1.0)
        self.uv_list = [Vector().from_dict(uv) for uv in data.get('uv_list', [])]
        self.normal_list = [Vector().from_dict(normal) for normal in data.get('normal_list', [])]
        self.texture_number = data.get('texture_number', -1)
        self.border_loop = data.get('border_loop', [])
        return self
    
    def render(self, random_colors=False):
        from OpenGL.GL import glMaterialfv, GL_FRONT, GL_SPECULAR, GL_SHININESS, GL_AMBIENT, GL_DIFFUSE, glColor3f

        glMaterialfv(GL_FRONT, GL_SPECULAR, [1.0, 1.0, 1.0, 1.0])
        glMaterialfv(GL_FRONT, GL_SHININESS, [30.0])
        glMaterialfv(GL_FRONT, GL_AMBIENT, [self.color.x * 0.3, self.color.y * 0.3, self.color.z * 0.3, 1.0])
        glMaterialfv(GL_FRONT, GL_DIFFUSE, [self.color.x, self.color.y, self.color.z, 1.0])
        
        glColor3f(self.color.x, self.color.y, self.color.z)
        
        super().render(random_colors=random_colors)

    def render_border(self):
        from OpenGL.GL import glColor3f, glLineWidth, glBegin, glEnd, glVertex3f, GL_LINE_LOOP
        
        if self.border_loop is not None:
            scale = 1.001
            glColor3f(0.0, 0.0, 0.0)
            glLineWidth(4.0)
            glBegin(GL_LINE_LOOP)
            try:
                for i in self.border_loop:
                    point = self.vertex_list[i].clone()
                    point *= scale      # This idea won't work in all cases.
                    glVertex3f(point.x, point.y, point.z)
            finally:
                glEnd()

    def calc_center(self):
        # For our purposes, this doesn't have to be an interior point that best represents
        # the center of the mesh (although I wish I had a good idea of how to calculate that.)
        # It just needs to be any interior point, but one furthest from the edge, if possible.
        # Of course, for convex shapes, this is easy, but not for concave shapes.
        largest_area = 0.0
        best_triangle = None
        for triangle in self.yield_triangles():
            area = triangle.area()
            if area > largest_area:
                largest_area = area
                best_triangle = triangle
        return best_triangle.calc_center()

    def calc_border_loop(self):
        self.border_loop = []
        try:
            line_loop_list = self.find_boundary_loops()
        except:
            pass    # Eat exceptions for now.  I still have some debugging to do here.
        else:
            if len(line_loop_list) == 1:
                self.border_loop = line_loop_list[0]

class GeneratorMesh(TriangleMesh):
    def __init__(self, mesh=None, center=None, axis=None, angle=None, pick_point=None, min_capture_count=None, max_capture_count=None):
        super().__init__(mesh=mesh)
        self.center = center if center is not None else Vector(0.0, 0.0, 0.0)
        self.axis = axis if axis is not None else Vector(0.0, 0.0, 1.0)
        self.angle = angle if angle is not None else 0.0
        self.pick_point = pick_point
        self.capture_tree_root = None
        self.min_capture_count = min_capture_count
        self.max_capture_count = max_capture_count

    def clone(self):
        return GeneratorMesh(mesh=super().clone(), axis=self.axis.clone(), angle=self.angle, pick_point=self.pick_point.clone())

    def to_dict(self):
        data = super().to_dict()
        data['center'] = self.center.to_dict()
        data['axis'] = self.axis.to_dict()
        data['angle'] = self.angle
        data['pick_point'] = self.pick_point.to_dict() if self.pick_point is not None else None
        data['capture_tree_root'] = self.capture_tree_root
        data['min_capture_count'] = self.min_capture_count
        data['max_capture_count'] = self.max_capture_count
        return data
    
    def from_dict(self, data):
        super().from_dict(data)
        self.center = Vector().from_dict(data.get('center', {}))
        self.axis = Vector().from_dict(data.get('axis', {}))
        self.angle = data.get('angle', 0.0)
        self.pick_point = Vector().from_dict(data.get('pick_point')) if data.get('pick_point') is not None else None
        self.capture_tree_root = data.get('capture_tree_root')
        self.min_capture_count = data.get('min_capture_count')
        self.max_capture_count = data.get('max_capture_count')
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

class ProfileBlock(object):
    def __init__(self, label):
        self.label = label
        self.start_time = None

    def __enter__(self):
        self.start_time = datetime.datetime.now()
        return self

    def __exit__(self, type, exc, tb):
        stop_time = datetime.datetime.now()
        delta_time = stop_time - self.start_time
        total_seconds = delta_time.total_seconds()
        print('%s: %f seconds' % (self.label, total_seconds))

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

    def can_apply_cutmesh_to_mesh(self, i, cut_mesh, cut_pass, mesh):
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
                        if not self.can_apply_cutmesh_to_mesh(i, cut_mesh, cut_pass, mesh):
                            new_mesh_list.append(mesh)
                        else:
                            back_mesh, front_mesh = mesh.split_against_mesh(cut_mesh)
                            if len(back_mesh.triangle_list) > 0:
                                new_mesh_list.append(ColoredMesh(mesh=back_mesh, color=mesh.color))
                            if len(front_mesh.triangle_list) > 0:
                                new_mesh_list.append(ColoredMesh(mesh=front_mesh, color=mesh.color))
                    final_mesh_list = new_mesh_list
                    # This is an optimization in terms of both time and memory.  Note that it is not needed for correctness.
                    for mesh in final_mesh_list:
                        mesh.reduce()

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

        return final_mesh_list, initial_mesh_list, generator_mesh_list
    
    def transform_meshes_for_more_cutting(self, mesh_list, generator_mesh_list, cut_pass):
        return False
    
    def apply_generator(self, mesh_list, generator_mesh, inverse=False):
        for i, mesh in enumerate(mesh_list):
            if generator_mesh.captures_mesh(mesh):
                mesh_list[i] = generator_mesh.transform_mesh(mesh, inverse)
    
    def generate_puzzle_file(self):
        with ProfileBlock('Generate meshes'):
            final_mesh_list, initial_mesh_list, generator_mesh_list = self.generate_final_mesh_list()
        
        with ProfileBlock('Calculate UVs'):
            self.calculate_uvs(final_mesh_list)
        
        with ProfileBlock('Calculate normals'):
            self.calculate_normals(final_mesh_list)
        
        with ProfileBlock('Calculate border loops'):
            for mesh in final_mesh_list:
                mesh.calc_border_loop()
        
        with ProfileBlock('Make puzzle file'):
            puzzle_data = {
                'mesh_list': [{**mesh.to_dict(), 'center': mesh.calc_center().to_dict()} for mesh in final_mesh_list],
                'generator_mesh_list': [{**mesh.to_dict(), 'plane_list': mesh.make_plane_list()} for mesh in generator_mesh_list],
                'bandages': self.bandages()
            }
            self.annotate_puzzle_data(puzzle_data)
            puzzle_path = 'puzzles/' + self.__class__.__name__ + '.json.gz'
            with gzip.open(puzzle_path, 'wb') as handle:
                json_text = json.dumps(puzzle_data, indent=4, separators=(',', ': '), sort_keys=True)
                json_bytes = json_text.encode('utf-8')
                handle.write(json_bytes)
        
        return puzzle_path

    def make_texture_space_transform_for_plane(self, plane):
        return None

    def calculate_uvs(self, final_mesh_list):
        
        class TexturePlane(object):
            def __init__(self, plane, mesh):
                if plane.center.dot(plane.unit_normal) < 0.0:
                    plane.unit_normal = -plane.unit_normal
                self.plane = plane
                self.mesh_list = [mesh]
        
            def is_parallel_with(self, other, eps=1e-7):
                dot = self.plane.unit_normal.dot(other.plane.unit_normal)
                dot = min(max(dot, -1.0), 1.0)
                angle = math.acos(dot)
                return math.fabs(angle) < eps
        
            def is_further_than(self, other):
                return self.plane.center.length() > other.plane.center.length()
        
            def make_texture_space_transform(self):
                # TODO: Make sure Y-axis is as close to actual Y-axis as possible.
                x_axis = self.plane.unit_normal.perpendicular_vector().normalized()
                y_axis = self.plane.unit_normal.cross(x_axis)
                z_axis = self.plane.unit_normal.clone()
                transform = AffineTransform(x_axis=x_axis, y_axis=y_axis, z_axis=z_axis, translation=self.plane.center)
                inverse_transform = transform.calc_inverse()
                return inverse_transform
        
        # Determine all texture planes and assign a list of meshes to each plane.
        plane_list = []
        for face_mesh in final_mesh_list:
            if face_mesh.alpha == 0.0:
                continue
            new_plane = TexturePlane(PointCloud(face_mesh.vertex_list).fit_plane(), face_mesh)
            for i, plane in enumerate(plane_list):
                if new_plane.is_parallel_with(plane):
                    if new_plane.is_further_than(plane):
                        new_plane.mesh_list += plane.mesh_list
                        plane_list[i] = new_plane
                    else:
                        plane.mesh_list += new_plane.mesh_list
                    break
            else:
                plane_list.append(new_plane)
        
        # Process each texture plane.
        for i, plane in enumerate(plane_list):
            
            # Assign a texture number to all meshes associated with the plane.
            for face_mesh in plane.mesh_list:
                face_mesh.texture_number = i
            
            # Make the transform taking us from model space to texture space.
            texture_transform = self.make_texture_space_transform_for_plane(plane.plane)
            if texture_transform is None:
                texture_transform = plane.make_texture_space_transform()

            # Calculate the extents of the texture space.
            x_min = 1000.0
            x_max = -1000.0
            y_min = 1000.0
            y_max = -1000.0
            for face_mesh in plane.mesh_list:
                vertex_list = [texture_transform(vertex) for vertex in face_mesh.vertex_list]
                for vertex in vertex_list:
                    if vertex.x < x_min:
                        x_min = vertex.x
                    if vertex.x > x_max:
                        x_max = vertex.x
                    if vertex.y < y_min:
                        y_min = vertex.y
                    if vertex.y > y_max:
                        y_max = vertex.y
            
            # Fix the aspect ratio of those extents so that the texture is not distorted.
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
            
            # Finally, go assign texture coordinates to each face mesh vertex.
            for face_mesh in plane.mesh_list:
                face_mesh.uv_list = []
                vertex_list = [texture_transform(vertex) for vertex in face_mesh.vertex_list]
                for vertex in vertex_list:
                    u = (vertex.x - x_min) / (x_max - x_min)
                    v = (vertex.y - y_min) / (y_max - y_min)
                    face_mesh.uv_list.append(Vector(u, v, 0.0))

    def calculate_normals(self, final_mesh_list):
        for mesh in final_mesh_list:
            mesh.normal_list = mesh.calc_vertex_normals()

    def annotate_puzzle_data(self, puzzle_data):
        pass
    
    def make_standard_cube_faces_using_base_mesh(self, base_mesh):
        l_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(0.0, 1.0, 0.0), -math.pi / 2.0, Vector(-1.0, 0.0, 0.0))(base_mesh), color=Vector(0.0, 0.0, 1.0))
        r_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(0.0, 1.0, 0.0), math.pi / 2.0, Vector(1.0, 0.0, 0.0))(base_mesh), color=Vector(0.0, 1.0, 0.0))
        d_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), math.pi / 2.0, Vector(0.0, -1.0, 0.0))(base_mesh), color=Vector(1.0, 1.0, 1.0))
        u_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), -math.pi / 2.0, Vector(0.0, 1.0, 0.0))(base_mesh), color=Vector(1.0, 1.0, 0.0))
        b_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), math.pi, Vector(0.0, 0.0, -1.0))(base_mesh), color=Vector(1.0, 0.5, 0.0))
        f_mesh = ColoredMesh(mesh=AffineTransform().make_rigid_body_motion(Vector(1.0, 0.0, 0.0), 0.0, Vector(0.0, 0.0, 1.0))(base_mesh), color=Vector(1.0, 0.0, 0.0))
        
        return [l_mesh, r_mesh, d_mesh, u_mesh, b_mesh, f_mesh]
    
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
    from puzzle_definitions import Rubiks2x3x3, Rubiks2x2x3, Crazy2x3x3, Gem8
    from puzzle_definitions import CubesOnDisk, WormHoleII, LatchCube, Rubiks3x3x5
    from puzzle_definitions import MultiCube

    puzzle_class_list = [
        RubiksCube, FisherCube, FusedCube, CurvyCopter,
        CurvyCopterPlus, HelicopterCube, FlowerCopter,
        Megaminx, DinoCube, FlowerRexCube, Skewb,
        SquareOne, Bagua, PentacleCube, MixupCube,
        Dogic, Bubbloid4x4x5, Rubiks2x2, Rubiks4x4,
        Pyraminx, BauhiniaDodecahedron, SkewbUltimate,
        Rubiks2x3x3, Rubiks2x2x3, Crazy2x3x3, Gem8,
        CubesOnDisk, WormHoleII, LatchCube, Rubiks3x3x5,
        MultiCube
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
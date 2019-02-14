# puzzle_generator.py

import argparse
import sys
import json

sys.path.append(r'c:\dev\pyMath3d')

from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_transform import AffineTransform
from math3d_vector import Vector

class ColoredMesh(TriangleMesh):
    def __init__(self, mesh=None, color=None):
        super().__init__(mesh=mesh)
        self.color = color if color is not None else Vector(0.0, 0.0, 0.0)

    def clone(self):
        return ColoredMesh(mesh=super().clone(), color=self.color.clone())

    def to_dict(self):
        data = super().to_dict()
        data['color'] = self.color.to_dict()
        return data

    def from_dict(self, data):
        super().from_dict(data)
        self.color = Vector().from_dict(data.get('color', {}))
        return self
    
    def render(self):
        from OpenGL.GL import glMaterialfv, GL_FRONT, GL_SPECULAR, GL_SHININESS, GL_AMBIENT, GL_DIFFUSE

        glMaterialfv(GL_FRONT, GL_SPECULAR, [1.0, 1.0, 1.0, 1.0])
        glMaterialfv(GL_FRONT, GL_SHININESS, [30.0])
        glMaterialfv(GL_FRONT, GL_AMBIENT, [self.color.x * 0.3, self.color.y * 0.3, self.color.z * 0.3, 1.0])
        glMaterialfv(GL_FRONT, GL_DIFFUSE, [self.color.x, self.color.y, self.color.z, 1.0])
        
        super().render()

class GeneratorMesh(TriangleMesh):
    def __init__(self, mesh=None, transform=None):
        super().__init__(mesh=mesh)
        self.transform = transform if transform is not None else AffineTransform()

    def to_dict(self):
        data = super().to_dict()
        data['transform'] = self.transform.to_dict()
        return data
    
    def from_dict(self, data):
        super().from_dict(data)
        self.transform = AffineTransform().from_dict(data.get('transform', {}))
        return self

class PuzzleDefinitionBase(object):
    def __init__(self):
        pass
    
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
    
    def generate_final_mesh_list(self):
        mesh_list = self.make_initial_mesh_list()
        generator_mesh_list = self.make_generator_mesh_list()
        
        for cut_mesh in generator_mesh_list:
            new_mesh_list = []
            for mesh in mesh_list:
                back_mesh, front_mesh = mesh.split_against_mesh(cut_mesh)
                if len(back_mesh.triangle_list) > 0:
                    new_mesh_list.append(ColoredMesh(mesh=back_mesh, color=mesh.color))
                if len(front_mesh.triangle_list) > 0:
                    new_mesh_list.append(ColoredMesh(mesh=front_mesh, color=mesh.color))
            mesh_list = new_mesh_list
        
        return mesh_list, generator_mesh_list
    
    def generate_puzzle_file(self):
        final_mesh_list, generator_mesh_list = self.generate_final_mesh_list()
        
        puzzle_data = {
            'mesh_list': [mesh.to_dict() for mesh in final_mesh_list],
            'generator_mesh_list': [mesh.to_dict() for mesh in generator_mesh_list]
        }

        puzzle_path = 'puzzles/' + self.__class__.__name__ + '.json'
        with open(puzzle_path, 'w') as handle:
            json_text = json.dumps(puzzle_data, indent=4, separators=(',', ': '), sort_keys=True)
            handle.write(json_text)
        
        return puzzle_path

def main():
    from puzzle_definitions import RubiksCube
    from puzzle_definitions import CurvyCopter

    puzzle_class_list = [
        RubiksCube,
        CurvyCopter
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
// puzzle_sequence.js

class Token {
    constructor(text, type) {
        this.text = text;
        this.type = type;
    }
}

class TreeNode {
    constructor() {
        this.inverse = false;
        this.reverse = false;
        this.modifier = 'none';
        this.quantifier = 1;
        this.identifier = '';
        this.children = [];
    }
    
    generate_sequence(puzzle) {
        let move_sequence = [];
        
        if(this.identifier.length > 0) {
            let base_move = puzzle.create_move_for_notation(this.identifier);
            if(!base_move) {
                let axis = this._axis_for_notation();
                base_move = puzzle.create_move_for_viewer_axis(axis);
            }
            
            // Here, repeating and distributing are the same thing.
            for(let i = 0; i < this.quantifier; i++) {
                let move = base_move.clone();
                move.inverse = this.inverse;
                move_sequence.push(move);
            }
        } else {
            for(let i = 0; i < this.children.length; i++) {
                let node = this.children[i];
                move_sequence = move_sequence.concat(node.generate_sequence(puzzle));
            }
            
            if(this.reverse)
                move_sequence.reverse();
            
            if(this.inverse) {
                move_sequence.reverse();
                for(let i = 0; i < move_sequence.length; i++)
                    move_sequence[i].inverse = !move_sequence[i].inverse;
            }
            
            let new_move_sequence = move_sequence;
            if(this.modifier === 'repeat') {
                new_move_sequence = [];
                for(let i = 0; i < this.quantifier; i++)
                    new_move_sequence = new_move_sequence.concat(move_sequence.slice());
                
            } else if(this.modifier === 'distribute') {
                new_move_sequence = [];
                for(let i = 0; i < move_sequence.length; i++)
                    for(let j = 0; j < this.quantifier; j++)
                        new_move_sequence.push(move_sequence[i].clone());
            }
            move_sequence = new_move_sequence;
        }
        
        return move_sequence;
    }
    
    _axis_for_notation() {
        let axis = vec3.create();
            
        // This notation comes from cube-based puzzles, but it will work with any shaped puzzle,
        // you just might not rotate the face you intended.  I may add notation for other shapes.
        if(this.identifier === 'L')
            vec3.set(axis, -1.0, 0.0, 0.0);
        else if(this.identifier === 'R')
            vec3.set(axis, 1.0, 0.0, 0.0);
        else if(this.identifier === 'D')
            vec3.set(axis, 0.0, -1.0, 0.0);
        else if(this.identifier === 'U')
            vec3.set(axis, 0.0, 1.0, 0.0);
        else if(this.identifier === 'B')
            vec3.set(axis, 0.0, 0.0, -1.0);
        else if(this.identifier === 'F')
            vec3.set(axis, 0.0, 0.0, 1.0);
        else if(this._all_combos('UL').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, 1.0, 0.0);
        else if(this._all_combos('UR').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, 1.0, 0.0);
        else if(this._all_combos('UB').indexOf(this.identifier) >= 0)
            vec3.set(axis, 0.0, 1.0, -1.0);
        else if(this._all_combos('UF').indexOf(this.identifier) >= 0)
            vec3.set(axis, 0.0, 1.0, 1.0);
        else if(this._all_combos('DL').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, -1.0, 0.0);
        else if(this._all_combos('DR').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, -1.0, 0.0);
        else if(this._all_combos('DB').indexOf(this.identifier) >= 0)
            vec3.set(axis, 0.0, -1.0, -1.0);
        else if(this._all_combos('DF').indexOf(this.identifier) >= 0)
            vec3.set(axis, 0.0, -1.0, 1.0);
        else if(this._all_combos('BL').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, 0.0, -1.0);
        else if(this._all_combos('BR').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, 0.0, -1.0);
        else if(this._all_combos('FL').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, 0.0, 1.0);
        else if(this._all_combos('FR').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, 0.0, 1.0);
        else if(this._all_combos('LDB').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, -1.0, -1.0);
        else if(this._all_combos('RDB').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, -1.0, -1.0);
        else if(this._all_combos('LUB').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, 1.0, -1.0);
        else if(this._all_combos('RUB').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, 1.0, -1.0);
        else if(this._all_combos('LDF').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, -1.0, 1.0);
        else if(this._all_combos('RDF').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, -1.0, 1.0);
        else if(this._all_combos('LUF').indexOf(this.identifier) >= 0)
            vec3.set(axis, -1.0, 1.0, 1.0);
        else if(this._all_combos('RUF').indexOf(this.identifier) >= 0)
            vec3.set(axis, 1.0, 1.0, 1.0);
        else
            throw 'Unknown identifier: ' + this.identifier;
        
        return axis;
    }
    
    _all_combos(text) {
        let combo_list = [];
        let a = text.charAt(0);
        let b = text.slice(1);
        if(b.length === 1) {
            combo_list = [a + b, b + a];
        } else {
            let sub_combo_list = this._all_combos(b);
            for(let i = 0; i < sub_combo_list.length; i++) {
                for(let j = 0; j < sub_combo_list[i].length; j++)
                    combo_list.push(sub_combo_list[i].slice(0, j) + a + sub_combo_list[i].slice(j));
                combo_list.push(sub_combo_list[i] + a);
            }
        }
        return combo_list;
    }
}

class PuzzleSequenceMoveGenerator {
    constructor() {
        this.stored_sequences_map = {};
    }
    
    generate_move_sequence(sequence_text, puzzle) {
        let move_sequence = [];
        
        try {
            let sequence_token_list = this._tokenize_sequence_text(sequence_text);
            let root_node = this._parse_sequence_token_list(sequence_token_list);
            move_sequence = root_node.generate_sequence(puzzle);
        } catch(error) {
            alert('Error: ' + error);
            move_sequence = [];
        }
        
        return move_sequence;
    }
    
    _tokenize_sequence_text(sequence_text) {
        let sequence_token_list = [];
        let i, j;
        
        let sequence_list = sequence_text.split(/\s+/);
        sequence_text = sequence_list.reduce((text, value) => text + value);
        
        i = 0;
        while(i < sequence_text.length) {
            if(this._is_letter(sequence_text.charAt(i))) {
                j = i;
                while(j < sequence_text.length && (this._is_letter(sequence_text.charAt(j)) || this._is_number(sequence_text.charAt(j)))) {
                    j += 1;
                }
                sequence_token_list.push(new Token(sequence_text.slice(i, j), 'identifier'));
                i = j;
            } else if(this._is_number(sequence_text.charAt(i))) {
                j = i;
                while(j < sequence_text.length && (this._is_number(sequence_text.charAt(j)) || sequence_text.charAt(j) === '.')) {
                    j += 1;
                }
                sequence_token_list.push(new Token(sequence_text.slice(i, j), 'number'));
                i = j;
            } else if(sequence_text.charAt(i) === ',' || sequence_text.charAt(i) === ';') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'delimiter'));
                i += 1;
            } else if(sequence_text.charAt(i) === '(') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'open round bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === ')') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'close round bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === '[') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'open square bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === ']') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'close square bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === '{') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'open curly bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === '}') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'close curly bracket'));
                i += 1;
            } else if(sequence_text.charAt(i) === '=') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'assignment'));
                i += 1;
            } else if(sequence_text.charAt(i) === '\'') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'inverse'));
                i += 1;
            } else if(sequence_text.charAt(i) === '~') {
                sequence_token_list.push(new Token(sequence_text.slice(i, i + 1), 'reverse'));
                i += 1;
            }
        }
        
        return sequence_token_list;
    }
    
    _parse_sequence_token_list(sequence_token_list) {
        let node = new TreeNode();
        
        let i, j;
        
        let sequence_list = [];
        i = 0;
        while(i < sequence_token_list.length) {
            j = i;
            while(j < sequence_token_list.length && sequence_token_list[j].type !== 'delimiter') {
                if(sequence_token_list[j].type.indexOf('open') === 0)
                    j = this._find_matching_bracket(sequence_token_list, j);
                else
                    j += 1;
            }
            sequence_list.push(sequence_token_list.slice(i, j));
            i = j;
            if(i < sequence_token_list.length)
                i += 1;
        }
        
        if(sequence_list.length > 1) {
            for(i = 0; i < sequence_list.length; i++)
                node.children.push(this._parse_sequence_token_list(sequence_list[i]));
        } else if(sequence_list.length == 1) {
            sequence_token_list = sequence_list[0];

            let initial_length = sequence_token_list.length;

            if(sequence_token_list.length > 0 && sequence_token_list[0].type === 'number') {
                node.quantifier = parseInt(sequence_token_list[0].text);
                sequence_token_list.splice(0, 1);
            }
            
            while(sequence_token_list.length > 0) {
                if(sequence_token_list[sequence_token_list.length - 1].type === 'inverse') {
                    node.inverse = !node.inverse;
                    sequence_token_list.splice(sequence_token_list.length - 1, 1);
                    continue;
                } else if(sequence_token_list[sequence_token_list.length - 1].type === 'reverse') {
                    node.reverse = !node.reverse;
                    sequence_token_list.splice(sequence_token_list.length - 1, 1);
                    continue;
                }
                break;
            }

            if(sequence_token_list.length > 0) {
                if(sequence_token_list[0].type === 'open curly bracket') {
                    if(sequence_token_list[sequence_token_list.length - 1].type !== 'close curly bracket')
                        throw 'Mismatched curly brackets at ' + sequence_token_list.reduce((substr, token) => substr + token.text);
                    node.modifier = 'distribute';
                    sequence_token_list.splice(0, 1);
                    sequence_token_list.splice(sequence_token_list.length - 1, 1);
                } else if(sequence_token_list[0].type === 'open square bracket') {
                    if(sequence_token_list[sequence_token_list.length - 1].type !== 'close square bracket')
                        throw 'Mismatched square brackets at ' + sequence_token_list.reduce((substr, token) => substr + token.text);
                    node.modifier = 'repeat';
                    sequence_token_list.splice(0, 1);
                    sequence_token_list.splice(sequence_token_list.length - 1, 1);
                } else if(sequence_token_list[0].type === 'open round bracket') {
                    if(sequence_token_list[sequence_token_list.length - 1].type !== 'close round bracket')
                        throw 'Mismatched round brackets at ' + sequence_token_list.reduce((substr, token) => substr + token.text);
                    node.modifier = 'none';
                    sequence_token_list.splice(0, 1);
                    sequence_token_list.splice(sequence_token_list.length - 1, 1);
                }
            }

            let final_length = sequence_token_list.length;
            
            if(sequence_token_list.length === 1 && sequence_token_list[0].type === 'identifier') {
                node.identifier = sequence_token_list[0].text;
            } else if(final_length < initial_length) {
                node.children.push(this._parse_sequence_token_list(sequence_token_list));
            } else {
                throw 'Can\'t parse sub-string: ' + sequence_token_list.reduce((substr, token) => substr + token.text);
            }
        } else {
            throw 'Encountered zero-length token list during parsing.';
        }
        
        return node;
    }
    
    _find_matching_bracket(sequence_token_list, i) {
        let level = 0;
        
        do {
            if(sequence_token_list[i].type.indexOf('open') === 0)
                level += 1;
            else if(sequence_token_list[i].type.indexOf('close') === 0)
                level -= 1;
            i += 1;
        } while(level > 0);
        
        return i;
    }
    
    _is_number(char) {
        return '0123456789'.indexOf(char) === -1 ? false : true;
    }
    
    _is_letter(char) {
        if('abcdefghijklmnopqrstuvwxyz'.indexOf(char) !== -1)
            return true;
        if('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(char) !== -1)
            return true;
        return false;
    }
}
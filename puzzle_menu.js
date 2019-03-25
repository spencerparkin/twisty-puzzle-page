// puzzle_menu.js

class PuzzleMenu {
    constructor(callback) {
        this.callback = callback;
        this.alpha_target = 0.0;
        this.alpha = 0.0;
        this.scrollX = 0;
        this.mouseX = 0;
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'puzzle_menu.json',
                dataType: 'json',
                success: puzzle_menu_list => {
                    
                    let puzzle_menu_container = document.getElementById('puzzle_menu_container');
                    while(puzzle_menu_container.firstChild)
                        puzzle_menu_container.removechild(puzzle_menu_container.firstChild);
                    
                    for(let i = 0; i < puzzle_menu_list.length; i++) {
                        let puzzle_menu_item = puzzle_menu_list[i];
                        let puzzle_menu_icon = document.createElement('img');
                        puzzle_menu_icon.classList.add('puzzle_icon');
                        puzzle_menu_icon.src = 'images/' + puzzle_menu_item.puzzle_name + '.png';
                        puzzle_menu_icon.addEventListener('click', () => {
                            this.menu_item_clicked(puzzle_menu_item.puzzle_name);
                        });
                        puzzle_menu_icon.addEventListener('mouseover', () => {
                            this.menu_item_mouse_over(puzzle_menu_icon, puzzle_menu_item.puzzle_label);
                        });
                        puzzle_menu_icon.addEventListener('mouseout', () => {
                            this.menu_item_mouse_out(puzzle_menu_icon);
                        });
                        puzzle_menu_container.appendChild(puzzle_menu_icon);
                    }
                    
                    puzzle_menu_container.addEventListener('mousemove', event => {
                        this.menu_mouse_move(event);
                    });
                    puzzle_menu_container.addEventListener('mouseover', event => {
                        this.menu_mouse_over(event);
                    });
                    puzzle_menu_container.addEventListener('mouseout', event => {
                        this.menu_mouse_out(event);
                    });
                    
                    resolve('RubiksCube');
                },
                failure: error => {
                    alert(error);
                    reject();
                }
            });
        });
    }
    
    lerp_value(value_a, value_b, t, eps=1e-6) {
        let value = value_a + t * (value_b - value_a);
        if(Math.abs(value - value_b) < eps)
            value = value_b;
        return value;
    }
    
    update() {
        let puzzle_menu_container = document.getElementById('puzzle_menu_container');
        
        this.alpha = this.lerp_value(this.alpha, this.alpha_target, 0.05);
        puzzle_menu_container.style.opacity = this.alpha;

        if(this.alpha > 0) {        
            let threshold = 300.0;
            let min_size = 70.0;
            let max_size = 140.0;
            let size = min_size;
            let x = this.scrollX;
            let total_weight = 0.0;
            
            for(let i = 0; i < puzzle_menu_container.children.length; i++) {
                let puzzle_icon = puzzle_menu_container.children[i];
                let distance = Math.abs(x + size - this.mouseX);
                if(distance < threshold) {
                    puzzle_icon.menu_weight = Math.pow(threshold - distance, 5.0);
                } else {
                    puzzle_icon.menu_weight = 0.0;
                }
                total_weight += puzzle_icon.menu_weight;
                x += size;
            }
            
            x = this.scrollX;
            for(let i = 0; i < puzzle_menu_container.children.length; i++) {
                let puzzle_icon = puzzle_menu_container.children[i];
                let t = puzzle_icon.menu_weight / total_weight;
                puzzle_icon.menu_size = this.lerp_value(min_size, max_size, t);
                puzzle_icon.menu_x = x;
                x += puzzle_icon.menu_size;
            }
            
            for(let i = 0; i < puzzle_menu_container.children.length; i++) {
                let puzzle_icon = puzzle_menu_container.children[i];
                puzzle_icon.style.width = puzzle_icon.menu_size.toString() + 'px';
                puzzle_icon.style.height = puzzle_icon.menu_size.toString() + 'px';
                puzzle_icon.style.left = puzzle_icon.menu_x.toString() + 'px';
            }
            
            let max_scroll_speed = 10.0;
            let scroll_velocity = 0.0;
            let min_x = puzzle_menu_container.offsetWidth / 5;
            let max_x = puzzle_menu_container.offsetWidth - min_x;
            if(this.mouseX < min_x)
                scroll_velocity = max_scroll_speed * (min_x - this.mouseX) / min_x;
            else if(this.mouseX > max_x) {
                let last_icon = puzzle_menu_container.children[puzzle_menu_container.children.length - 1];
                if(last_icon.menu_x + last_icon.menu_size >= puzzle_menu_container.offsetWidth)
                    scroll_velocity = -max_scroll_speed * (this.mouseX - max_x) / min_x;
            }
            this.scrollX += scroll_velocity;
            if(this.scrollX > 0)
                this.scrollX = 0;
        }
    }
    
    dilate_icon(j, delta) {
        let puzzle_icon = puzzle_menu_container.children[i];
        puzzle_icon.size += delta;
        puzzle_icon.x -= delta / 2;
    }
    
    menu_mouse_move(event) {
        this.mouseX = event.pageX;
    }
    
    menu_mouse_over(event) {
        this.alpha_target = 1.0;
    }
    
    menu_mouse_out(event) {
        this.alpha_target = 0.0;
    }
    
    menu_item_clicked(puzzle_name) {
        this.callback(puzzle_name);
    }
    
    menu_item_mouse_over(puzzle_icon, puzzle_label) {
        // TODO: Add tool-tips with puzzle labels.
    }
    
    menu_item_mouse_out(puzzle_icon) {
    
    }
}